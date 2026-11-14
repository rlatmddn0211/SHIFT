import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { test, type TestContext } from "node:test";
import { createShiftServer } from "./server.ts";

const VEHICLE = "/api/vehicles/hyundai-demo-01";
const PUBLIC_ORIGIN = "http://example.test:8787";

type Challenge = { requestId: string; approvalUrl: string; pin: string; expiresAt: number };

async function fixture(t: TestContext) {
    let time = 1_700_000_000_000;
    const server = createShiftServer({ publicOrigin: PUBLIC_ORIGIN, now: () => time });
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
    assert.ok(!successPage.includes(state.sessionToken));
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
