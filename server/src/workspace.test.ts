import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createWorkspace } from "./workspace.ts";
import { createWorkspaceStore } from "./workspace-data.ts";

const API = "/api/vehicles/hyundai-demo-01/workspace";
const AUTH_A = { Authorization: "Bearer employee-a" };
const AUTH_B = { Authorization: "Bearer employee-b" };

async function setup(options: { storageFile?: string; fetcher?: typeof fetch; enableNavTest?: boolean } = {}) {
    let app: ReturnType<typeof createWorkspace>;
    const server = createServer((request, response) => {
        const path = new URL(request.url ?? "/", "http://localhost").pathname;
        if (path === "/test/approve") {
            app.authorizeMobile(response, "employee-a");
            response.end("test setup");
            return;
        }
        const id = request.headers.authorization?.slice(7);
        app.handle(request, response, path, () => id).then(handled => {
            if (!handled) response.writeHead(404).end();
        });
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Bad test listener");
    const base = `http://127.0.0.1:${address.port}`;
    app = createWorkspace({ publicOrigin: base, storageFile: options.storageFile ?? "", fetcher: options.fetcher,
        enableNavTest: options.enableNavTest ?? false });
    return { server, base };
}

function requestCookie(response: Response) {
    return response.headers.getSetCookie().map(line => line.split(";", 1)[0]).join("; ");
}

function csrfField(source: string) {
    const match = source.match(/name="csrf" value="([^"]+)"/);
    assert.ok(match);
    return match[1];
}

test("workspace hides other employees' visits and serves selected notes only with a vehicle session", async t => {
    const { server, base } = await setup();
    t.after(() => server.close());
    assert.equal((await fetch(`${base}${API}`)).status, 401);
    const a = await (await fetch(`${base}${API}`, { headers: AUTH_A })).json();
    const b = await (await fetch(`${base}${API}`, { headers: AUTH_B })).json();
    assert.equal(a.source, "demo");
    assert.equal(a.visits[0].id, "a-visit-1");
    assert.equal(a.visits.length, 3);
    assert.equal(b.visits[0].id, "b-visit-1");
    assert.match(a.briefing.text, /판교역로 235/);
    assert.equal((await fetch(`${base}${API}/notes/b-note-1`, { headers: AUTH_A })).status, 404);
    const note = await (await fetch(`${base}${API}/notes/a-note-1`, { headers: AUTH_A })).json();
    assert.match(note.text, /납기/);
});

test("navigation QA adds the official destination to employee A's demo visits only", async t => {
    const { server, base } = await setup({ enableNavTest: true });
    t.after(() => server.close());
    const a = await (await fetch(`${base}${API}`, { headers: AUTH_A })).json();
    const b = await (await fetch(`${base}${API}`, { headers: AUTH_B })).json();
    assert.equal(a.visits[0].id, "a-visit-1");
    assert.equal(a.visits.length, 4);
    const { id, time, title, address, latitude, longitude, poiId, poiName } = a.visits[3];
    assert.deepEqual({ id, time, title, address, latitude, longitude, poiId, poiName }, {
        id: "a-visit-nav-test", time: "16:40", title: "42dot · 내비 시험", address: "서울시 강남구 남부순환로 2621",
        latitude: 37.48544722, longitude: 127.03636666, poiId: "36khp37hh8gqcm5nqhe5", poiName: "42dot",
    });
    assert.deepEqual(b.visits.map((visit: { id: string }) => visit.id), ["b-visit-1", "b-visit-2", "b-visit-3"]);
});

test("mobile changes a profile with CSRF validation and saved notes are escaped, idempotent, and durable", async t => {
    const file = join(mkdtempSync(join(tmpdir(), "shift-workspace-test-")), "workspace.json");
    const { server, base } = await setup({ storageFile: file });
    t.after(() => server.close());
    assert.equal((await fetch(`${base}/mobile`)).status, 401);
    const session = await fetch(`${base}/test/approve`);
    const cookie = requestCookie(session);
    const profile = await fetch(`${base}/mobile`, { headers: { cookie } });
    assert.equal(profile.status, 200);
    const csrf = csrfField(await profile.text());
    const form = new URLSearchParams({ csrf: "invalid", seatHeight: "25", seatPosition: "75", speakBriefing: "yes" });
    assert.equal((await fetch(`${base}/mobile`, { method: "POST", headers: { cookie }, body: form })).status, 403);
    form.set("csrf", csrf);
    const save = await fetch(`${base}/mobile`, { method: "POST", headers: { cookie }, body: form, redirect: "manual" });
    assert.equal(save.status, 303);
    const result = await (await fetch(`${base}${API}`, { headers: AUTH_A })).json();
    assert.deepEqual(result.profile, { seatHeight: 25, seatPosition: 75, speakBriefing: true });
    assert.deepEqual(result.notes, []);
    const body = JSON.stringify({ requestId: "idempotent-note", visitId: "a-visit-1", text: "회신 준비\n<script>test</script>" });
    const send = () => fetch(`${base}${API}/notes`, { method: "POST", headers: { ...AUTH_A, "Content-Type": "application/json" }, body }).then(response => response.json());
    const [first, repeated] = await Promise.all([send(), send()]);
    assert.ok(first.id);
    assert.deepEqual(first, repeated);
    const mobileNotes = await (await fetch(`${base}/mobile/notes`, { headers: { cookie } })).text();
    assert.match(mobileNotes, /&lt;script&gt;test&lt;\/script&gt;/);
    assert.doesNotMatch(mobileNotes, /<script>/);
    const saved = createWorkspaceStore(file);
    assert.equal(saved.read("employee-a").notes.length, 1);
    assert.equal(saved.read("employee-a").profile.seatHeight, 25);
    assert.equal(saved.read("employee-b").notes.length, 0);
});

test("OAuth consent binds its callback to the originating browser and routes verified Microsoft identity", async t => {
    const env = { SHIFT_MICROSOFT_CLIENT_ID: "test-client", SHIFT_MICROSOFT_CLIENT_SECRET: "test-secret", SHIFT_MICROSOFT_TENANT: "organizations" };
    for (const [key, value] of Object.entries(env)) {
        const old = process.env[key];
        process.env[key] = value;
        t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
    }
    const requests: string[] = [];
    const mock: typeof fetch = async (input, init) => {
        const url = new URL(String(input));
        requests.push(url.pathname);
        if (url.pathname.endsWith("/token")) {
            assert.ok((init?.body as URLSearchParams).get("code_verifier"));
            return Response.json({ access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 });
        }
        if (url.pathname === "/v1.0/me") return Response.json({ id: "guid", displayName: "테스트 사용자", userPrincipalName: "test@example.com" });
        throw new Error(`Unexpected Graph route ${url.pathname}`);
    };
    const { server, base } = await setup({ fetcher: mock });
    t.after(() => server.close());
    const connect = await fetch(`${base}/mobile/microsoft/connect`);
    const cookie = requestCookie(connect);
    const csrf = csrfField(await connect.text());
    const consent = await fetch(`${base}/mobile/microsoft/connect`, { method: "POST", headers: { cookie },
        body: new URLSearchParams({ csrf }), redirect: "manual" });
    assert.equal(consent.status, 303);
    const upstream = new URL(consent.headers.get("location")!);
    assert.equal(upstream.hostname, "login.microsoftonline.com");
    assert.equal(upstream.searchParams.get("scope"), "offline_access User.Read");
    assert.equal(upstream.searchParams.get("code_challenge_method"), "S256");
    const callbackUrl = `${base}/mobile/microsoft/callback?code=one-time-code&state=${upstream.searchParams.get("state")}`;
    assert.equal((await fetch(callbackUrl, { redirect: "manual" })).status, 403);
    const callback = await fetch(callbackUrl, { headers: { cookie }, redirect: "manual" });
    assert.equal(callback.status, 303);
    assert.equal((await fetch(callbackUrl, { headers: { cookie }, redirect: "manual" })).status, 403);
    const profile = await fetch(`${base}/mobile`, { headers: { cookie: requestCookie(callback) } });
    assert.match(await profile.text(), /테스트 사용자 · Microsoft 365/);
    assert.deepEqual(requests, ["/organizations/oauth2/v2.0/token", "/v1.0/me"]);
});
