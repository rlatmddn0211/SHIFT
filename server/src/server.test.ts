import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test, type TestContext } from "node:test";
import { createShiftServer } from "./server.ts";

const VEHICLE = "/api/vehicles/hyundai-demo-01";
const PUBLIC_ORIGIN = "http://example.test:8787";

type Challenge = { requestId: string; approvalUrl: string; pin: string; expiresAt: number };
type Logout = Omit<Challenge, "pin">;

async function fixture(t: TestContext) {
    let time = 1_700_000_000_000;
    const server = createShiftServer({ publicOrigin: PUBLIC_ORIGIN, now: () => time, storageFile: "" });
    const listening = once(server, "listening");
    server.listen(0, "127.0.0.1");
    await listening;
    t.after(() => new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
    }));
    const { port } = server.address() as AddressInfo;
    const get = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init);
    const approvalPath = (login: Challenge) => new URL(login.approvalUrl).pathname;
    const approve = (login: Challenge, employee = "employee-a", pin = login.pin) =>
        get(approvalPath(login), { method: "POST", body: new URLSearchParams({ employee, pin }), redirect: "manual" });
    const status = async (login: Challenge) => {
        const response = await get(`${VEHICLE}/login-requests/${login.requestId}`);
        assert.equal(response.status, 200);
        return response.json();
    };

    return {
        get, approvalPath, approve, status,
        advance(milliseconds: number) {
            time += milliseconds;
        },
        async create(): Promise<Challenge> {
            const response = await get(`${VEHICLE}/login-requests`, { method: "POST" });
            assert.equal(response.status, 201);
            assert.equal(response.headers.get("cache-control"), "no-store");
            return response.json();
        },
        session(token: string) {
            return get(`${VEHICLE}/session`, { headers: { Authorization: `Bearer ${token}` } });
        },
        async logout(sessionToken: string): Promise<Logout> {
            const response = await get(`${VEHICLE}/logout-requests`, {
                method: "POST", headers: { Authorization: `Bearer ${sessionToken}` },
            });
            assert.equal(response.status, 201);
            return response.json();
        },
        logoutStatus(logout: Logout, sessionToken: string, method = "GET") {
            return get(`${VEHICLE}/logout-requests/${logout.requestId}`, {
                method, headers: { Authorization: `Bearer ${sessionToken}` },
            });
        },
    };
}

test("vehicle and QR tokens are separate and only vehicle polling returns the session", async (t) => {
    const api = await fixture(t);
    const login = await api.create();
    assert.match(login.pin, /^\d{6}$/);
    const url = new URL(login.approvalUrl);
    assert.equal(url.origin, PUBLIC_ORIGIN);
    assert.equal(url.search, "");
    const phoneToken = url.pathname.split("/").at(-1);
    assert.match(phoneToken ?? "", /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(phoneToken, login.requestId);
    assert.equal((await api.get(`/api/vehicles/another-vehicle/login-requests/${login.requestId}`)).status, 404);
    assert.equal((await api.get(`${VEHICLE}/login-requests/${phoneToken}`)).status, 404);
    assert.deepEqual(await api.status(login), { status: "pending" });

    const page = await api.get(api.approvalPath(login));
    assert.equal(page.headers.get("referrer-policy"), "no-referrer");
    assert.match(await page.text(), /현대 공용차 01.*|차량 로그인 승인/);
    const result = await api.approve(login);
    assert.equal(result.status, 303);
    assert.equal(result.headers.get("location"), api.approvalPath(login));
    const state = await api.status(login);
    assert.equal(state.status, "approved");
    assert.equal(state.employeeName, "직원 A");
    assert.match(state.sessionToken, /^[A-Za-z0-9_-]{43}$/);
    assert.deepEqual(await api.status(login), state);
    assert.deepEqual(await (await api.session(state.sessionToken)).json(), { employeeName: "직원 A" });

    const success = await api.get(api.approvalPath(login));
    const successPage = await success.text();
    assert.match(successPage, /승인 완료/);
    assert.match(successPage, /업무·개인 설정 열기/);
    assert.ok(!successPage.includes(state.sessionToken));
    const cookie = result.headers.getSetCookie()[0]?.split(";", 1)[0];
    assert.ok(cookie);
    assert.match(await (await api.get("/mobile", { headers: { cookie } })).text(), /직원 A · 시연 계정/);
    const work = await api.get(`${VEHICLE}/workspace`, { headers: { Authorization: `Bearer ${state.sessionToken}` } });
    assert.equal(work.status, 200);
    assert.equal((await work.json()).visits[0].title, "한빛모빌리티 미팅");
    assert.equal((await api.approve(login, "employee-b")).status, 409);
    assert.deepEqual(await api.status(login), state);
});

test("wrong PIN locks after five submissions and cannot be reused", async (t) => {
    const api = await fixture(t);
    const login = await api.create();
    const wrongPin = login.pin === "000000" ? "111111" : "000000";
    for (let attempt = 1; attempt <= 5; attempt++) {
        const result = await api.approve(login, "employee-a", wrongPin);
        assert.equal(result.status, attempt === 5 ? 429 : 400);
        assert.match(await result.text(), /PIN/);
    }
    assert.deepEqual(await api.status(login), { status: "locked" });
    assert.equal((await api.approve(login)).status, 429);
});

test("PIN expires and a retried QR invalidates only the previous challenge", async (t) => {
    const api = await fixture(t);
    const first = await api.create();
    const second = await api.create();
    assert.deepEqual(await api.status(first), { status: "replaced" });
    assert.equal((await api.approve(first)).status, 409);

    api.advance(2 * 60_000);
    assert.deepEqual(await api.status(second), { status: "expired" });
    assert.equal((await api.approve(second)).status, 410);
});

test("concurrent approval can complete only once and employee B replaces employee A", async (t) => {
    const api = await fixture(t);
    const first = await api.create();
    const results = await Promise.all([api.approve(first), api.approve(first)]);
    assert.deepEqual(results.map((response) => response.status).sort(), [303, 409]);
    const employeeA = await api.status(first);

    const second = await api.create();
    assert.equal((await api.session(employeeA.sessionToken)).status, 200);
    assert.equal((await api.approve(second, "employee-b")).status, 303);
    const employeeB = await api.status(second);
    assert.equal(employeeB.employeeName, "직원 B");
    assert.notEqual(employeeB.sessionToken, employeeA.sessionToken);
    assert.equal((await api.session(employeeA.sessionToken)).status, 401);
    assert.deepEqual(await api.status(first), { status: "replaced" });
    assert.deepEqual(await (await api.session(employeeB.sessionToken)).json(), { employeeName: "직원 B" });

    api.advance(8 * 60 * 60_000);
    assert.equal((await api.session(employeeB.sessionToken)).status, 401);
    assert.deepEqual(await api.status(second), { status: "expired" });
});

test("logout requires the same mobile identity, revokes the session and cannot execute twice", async (t) => {
    const api = await fixture(t);
    const login = await api.create();
    const loginApproval = await api.approve(login);
    const mobile = loginApproval.headers.get("set-cookie")?.split(";")[0];
    assert.ok(mobile);
    const { sessionToken } = await api.status(login);
    const logout = await api.logout(sessionToken);
    const url = new URL(logout.approvalUrl);
    assert.equal(url.origin, PUBLIC_ORIGIN);
    assert.match(url.pathname, /^\/logout\/[A-Za-z0-9_-]{43}$/);
    assert.ok(!url.href.includes(sessionToken));
    assert.ok(!url.href.includes(logout.requestId));
    assert.ok(!url.search);
    assert.ok(!("pin" in logout));
    assert.equal((await api.get(`${VEHICLE}/logout-requests`, { method: "POST" })).status, 401);
    assert.equal((await api.get(url.pathname)).status, 403);
    assert.equal((await api.get(url.pathname, { method: "POST", redirect: "manual" })).status, 403);
    assert.equal((await api.session(sessionToken)).status, 200);

    const headers = { Cookie: mobile };
    assert.match(await (await api.get(url.pathname, { headers })).text(), /차량 로그아웃 승인/);
    assert.deepEqual(await (await api.logoutStatus(logout, sessionToken)).json(), { status: "pending" });
    assert.equal((await api.get(url.pathname, { method: "POST", headers, redirect: "manual" })).status, 303);
    assert.deepEqual(await (await api.logoutStatus(logout, sessionToken)).json(), { status: "approved" });
    assert.equal((await api.session(sessionToken)).status, 401);
    assert.match(await (await api.get(url.pathname, { headers })).text(), /로그아웃 완료/);
    assert.equal((await api.get(url.pathname, { method: "POST", headers, redirect: "manual" })).status, 409);
});

test("stale logout cannot revoke a later driver and canceled or expired requests are inert", async (t) => {
    const api = await fixture(t);
    const first = await api.create();
    const mobileA = (await api.approve(first)).headers.get("set-cookie")?.split(";")[0];
    assert.ok(mobileA);
    const employeeA = await api.status(first);
    const expired = await api.logout(employeeA.sessionToken);
    api.advance(2 * 60_000);
    const mobile = { Cookie: mobileA };
    assert.equal((await api.get(new URL(expired.approvalUrl).pathname, { method: "POST", headers: mobile })).status, 410);

    const canceled = await api.logout(employeeA.sessionToken);
    assert.deepEqual(await (await api.logoutStatus(canceled, employeeA.sessionToken, "DELETE")).json(), { status: "replaced" });
    assert.equal((await api.get(new URL(canceled.approvalUrl).pathname, { method: "POST", headers: mobile })).status, 409);
    const stale = await api.logout(employeeA.sessionToken);
    const second = await api.create();
    assert.equal((await api.session(employeeA.sessionToken)).status, 200);
    await api.approve(second, "employee-b");
    const employeeB = await api.status(second);
    assert.equal((await api.get(new URL(stale.approvalUrl).pathname, { method: "POST", headers: mobile })).status, 409);
    assert.equal((await api.session(employeeB.sessionToken)).status, 200);
    assert.equal((await api.logoutStatus(stale, employeeB.sessionToken)).status, 404);
});

test("canceling a pending handover keeps the active employee and bars late approval", async (t) => {
    const api = await fixture(t);
    const first = await api.create();
    await api.approve(first);
    const employeeA = await api.status(first);
    const handover = await api.create();
    const cancel = await api.get(`${VEHICLE}/login-requests/${handover.requestId}`, { method: "DELETE" });
    assert.deepEqual(await cancel.json(), { status: "replaced" });
    assert.equal((await api.approve(handover, "employee-b")).status, 409);
    assert.equal((await api.session(employeeA.sessionToken)).status, 200);
});
