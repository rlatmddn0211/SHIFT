import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createWorkspace } from "./workspace.ts";
import { createBriefing, createWorkspaceStore, profileDefaults, withLocationEvidence } from "./workspace-data.ts";

const API = "/api/vehicles/hyundai-demo-01/workspace";
const AUTH_A = { Authorization: "Bearer employee-a" };
const AUTH_B = { Authorization: "Bearer employee-b" };

async function setup(options: { storageFile?: string; fetcher?: typeof fetch; enableNavTest?: boolean; active?: (id: string) => boolean } = {}) {
    let app: ReturnType<typeof createWorkspace>;
    const server = createServer((request, response) => {
        const path = new URL(request.url ?? "/", "http://localhost").pathname;
        if (path === "/test/approve" || path === "/test/approve-b") {
            app.authorizeMobile(response, path.endsWith("-b") ? "employee-b" : "employee-a");
            response.end("test setup");
            return;
        }
        const id = request.headers.authorization?.slice(7);
        app.handle(request, response, path, () => id && (!options.active || options.active(id)) ? id : undefined).then(handled => {
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

function testEnv(t: TestContext, env: Record<string, string>) {
    for (const [key, value] of Object.entries(env)) {
        const old = process.env[key];
        process.env[key] = value;
        t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
    }
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

test("mobile visit notes require CSRF and remain idempotent and private on phone and vehicle", async t => {
    const { server, base } = await setup();
    t.after(() => server.close());
    const cookieA = requestCookie(await fetch(`${base}/test/approve`));
    const cookieB = requestCookie(await fetch(`${base}/test/approve-b`));
    const read = (cookie: string) => fetch(`${base}/mobile/notes`, { headers: { cookie, Accept: "application/json" } });
    const send = (cookie: string, body: object, origin = base) => fetch(`${base}/mobile/notes`, {
        method: "POST", headers: { cookie, origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
    });

    const anonymous = await read("");
    assert.equal(anonymous.status, 401);
    assert.equal(anonymous.headers.get("cache-control"), "no-store");
    assert.deepEqual(await anonymous.json(), { kind: "notes", title: "내 방문 메모", profileUrl: "/mobile", notes: [],
        message: "차량의 SHIFT QR에서 로그인한 후 열 수 있습니다." });
    const profileA = await (await read(cookieA)).json();
    const profileB = await (await read(cookieB)).json();
    assert.match(profileA.csrf, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(profileA.csrf, profileB.csrf);
    assert.equal(profileA.canSave, true);
    assert.deepEqual(profileA.visits[0], { id: "a-visit-1", title: "한빛모빌리티 미팅", time: "10:30" });
    assert.equal(profileB.visits[0].id, "b-visit-1");
    const body = { csrf: profileA.csrf, requestId: "exclude-from-phone-model", visitId: "a-visit-1", text: "직원 A 메모" };
    assert.equal((await send("", body)).status, 401);
    assert.equal((await send(cookieB, body)).status, 403);
    assert.equal((await send(cookieA, body, "https://outside.example")).status, 403);
    assert.equal((await send(cookieA, { ...body, visitId: "b-visit-1" })).status, 400);
    assert.equal((await send(cookieA, { ...body, text: "   " })).status, 400);
    assert.equal((await send(cookieA, { ...body, text: "가".repeat(3_001) })).status, 400);
    const writes = await Promise.all([send(cookieA, body), send(cookieA, body)]);
    assert.deepEqual(writes.map(response => response.status), [201, 201]);
    const [note, duplicate] = await Promise.all(writes.map(response => response.json()));
    assert.deepEqual(note, { id: note.id, title: "한빛모빌리티 미팅 · 방문 메모", text: "직원 A 메모", source: "demo" });
    assert.deepEqual(duplicate, note);
    assert.deepEqual((await (await read(cookieA)).json()).notes, [note]);
    assert.deepEqual((await (await read(cookieB)).json()).notes, []);

    const loadCar = (headers: HeadersInit) => fetch(`${base}${API}`, { headers }).then(response => response.json());
    const carA = await loadCar(AUTH_A);
    assert.deepEqual(carA.notes.map(item => item.id), ["a-note-1"]);
    const list = `${base}${API}/notes`;
    assert.equal((await fetch(list)).status, 401);
    assert.deepEqual(await (await fetch(list, { headers: AUTH_A })).json(), { notes: [{ id: note.id, title: note.title, source: "demo" }] });
    assert.deepEqual(await (await fetch(list, { headers: AUTH_B })).json(), { notes: [] });
    const detail = `${base}${API}/notes/${note.id}`;
    assert.equal((await fetch(detail)).status, 401);
    assert.equal((await fetch(detail, { headers: AUTH_B })).status, 404);
    assert.equal((await (await fetch(detail, { headers: AUTH_A })).json()).text, note.text);
});

test("Microsoft mobile notes require OneNote consent and read saved content through the same employee", async t => {
    testEnv(t, { SHIFT_MICROSOFT_CLIENT_ID: "test-client", SHIFT_MICROSOFT_CLIENT_SECRET: "test-secret", SHIFT_MICROSOFT_TENANT: "organizations" });
    const employee = `ms:${createHash("sha256").update("guid:test@example.com").digest("hex")}`;
    const savedHtml = new Map<string, string>();
    let calendarError = true;
    const mock: typeof fetch = async (input, init) => {
        const url = new URL(String(input));
        switch (url.pathname) {
            case "/organizations/oauth2/v2.0/token": return Response.json({ access_token: "test-access", expires_in: 3600 });
            case "/v1.0/me": return Response.json({ id: "guid", userPrincipalName: "test@example.com" });
            case "/v1.0/me/calendarView":
                if (calendarError) throw new Error("Outlook unavailable");
                return Response.json({ value: [{ id: "work-visit", subject: "업무 일정", start: { dateTime: "2026-11-14T11:10:00" } }] });
            case "/v1.0/me/onenote/pages":
                if (init?.method !== "POST") return Response.json({ value: [] });
                assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-access");
                savedHtml.set("note-page", String(init.body));
                return Response.json({ id: "note-page", links: { oneNoteWebUrl: { href: "https://www.onenote.com/note-page" } } });
            case "/v1.0/me/onenote/pages/note-page/content":
                assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-access");
                return new Response(savedHtml.get("note-page"));
            default: throw new Error(`Unexpected provider route: ${url.pathname}`);
        }
    };
    const { server, base } = await setup({ fetcher: mock });
    t.after(() => server.close());
    async function connect(notes: boolean) {
        const start = await fetch(`${base}/mobile/microsoft/connect`);
        const cookie = requestCookie(start);
        const body = new URLSearchParams({ csrf: csrfField(await start.text()), calendar: "yes" });
        if (notes) body.set("notes", "yes");
        const consent = await fetch(`${base}/mobile/microsoft/connect`, { method: "POST", headers: { cookie }, body, redirect: "manual" });
        const upstream = new URL(consent.headers.get("location")!);
        const callback = await fetch(`${base}/mobile/microsoft/callback?code=code&state=${upstream.searchParams.get("state")}`, { headers: { cookie }, redirect: "manual" });
        assert.equal(callback.status, 303);
        return requestCookie(callback);
    }
    const read = (cookie: string) => fetch(`${base}/mobile/notes`, { headers: { cookie, Accept: "application/json" } });
    const write = (cookie: string, csrf: string, visitId?: string) => fetch(`${base}/mobile/notes`, { method: "POST",
        headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify({ csrf, requestId: "ms-mobile-note", text: "첫 줄 & 메모\n둘째 줄 <확인>", visitId }) });

    const unconsented = await connect(false);
    const unconsentedPage = await (await read(unconsented)).json();
    assert.equal(unconsentedPage.canSave, false);
    assert.equal((await write(unconsented, unconsentedPage.csrf)).status, 403);
    assert.equal(savedHtml.size, 0);

    const consented = await connect(true);
    const page = await read(consented);
    assert.equal(page.status, 200);
    const model = await page.json();
    assert.deepEqual(model.visits, []);
    assert.equal(model.canSave, true);
    calendarError = false;
    assert.deepEqual((await (await read(consented)).json()).visits, [{ id: "work-visit", title: "업무 일정", time: "11:10" }]);
    assert.equal((await write(consented, model.csrf, "work-visit")).status, 201);
    assert.equal(savedHtml.size, 1);
    const metadata = { id: "note-page", title: "업무 일정 · 방문 메모", source: "microsoft365", sourceUrl: "https://www.onenote.com/note-page" };
    assert.deepEqual((await (await read(consented)).json()).notes, [metadata]);
    const headers = { Authorization: `Bearer ${employee}` };
    calendarError = true;
    assert.deepEqual(await (await fetch(`${base}${API}/notes`, { headers })).json(), { notes: [metadata] });
    assert.equal((await fetch(`${base}${API}/notes/note-page`, { headers: AUTH_B })).status, 404);
    const body = await (await fetch(`${base}${API}/notes/note-page`, { headers })).json();
    assert.equal(body.text, "첫 줄 & 메모\n둘째 줄 <확인>");
});

test("OAuth consent binds its callback to the originating browser and routes verified Microsoft identity", async t => {
    testEnv(t, { SHIFT_MICROSOFT_CLIENT_ID: "test-client", SHIFT_MICROSOFT_CLIENT_SECRET: "test-secret", SHIFT_MICROSOFT_TENANT: "organizations" });
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

test("briefing sends consented selected facts over authenticated HTTPS and falls back on errors", async t => {
    testEnv(t, { SHIFT_BRIEFING_URL: "https://briefing.example/summary", SHIFT_BRIEFING_TOKEN: "summary-test" });
    const profile = profileDefaults("employee-a");
    const data = {
        visits: [{ id: "visit", time: "10:30", title: "선택한 일정", address: "새 주소", changedFrom: "기존 주소" }],
        messages: [{ id: "a-mail-1", subject: "선택 메일", preview: "업무 근거", receivedAt: "09:12", sender: "직원" },
            { id: "unselected", subject: "비공개 메일", preview: "비공개 근거", receivedAt: "09:10", sender: "직원" }],
        notes: [{ id: "a-note-1", title: "비공개 노트" }],
    };
    const requests: { url: string; init?: RequestInit }[] = [];
    let fail = false;
    const mock: typeof fetch = async (url, init) => {
        requests.push({ url: String(url), init });
        return fail ? new Response(null, { status: 500 }) : Response.json({ text: "확인된 업무 요약" });
    };
    assert.equal((await createBriefing(profile, data, "demo", mock)).source, "demo");
    assert.equal(requests.length, 0);
    assert.deepEqual(await createBriefing({ ...profile, aiConsent: true }, data, "demo", mock), { source: "ai", text: "확인된 업무 요약" });
    const [request] = requests;
    assert.equal(request.url, "https://briefing.example/summary");
    assert.equal(request.init?.method, "POST");
    assert.equal(request.init?.redirect, "error");
    assert.equal(new Headers(request.init?.headers).get("Authorization"), "Bearer summary-test");
    assert.deepEqual(JSON.parse(String(request.init?.body)).details, ["10:30 선택한 일정 장소가 새 주소로 변경되었습니다.", "선택 메일. 업무 근거"]);
    fail = true;
    assert.equal((await createBriefing({ ...profile, aiConsent: true }, data, "microsoft365", mock)).source, "extractive");
    process.env.SHIFT_BRIEFING_URL = "http://briefing.example/summary";
    assert.equal((await createBriefing({ ...profile, aiConsent: true }, data, "demo", mock)).source, "demo");
    assert.equal(requests.length, 2);
});

test("mail corroborates only a uniquely linked, explicitly matching calendar location change", () => {
    const visit = { id: "graph-1", title: "한빛모빌리티 미팅", time: "10:30", address: "판교역로 235", changedFrom: "판교역로 166",
        latitude: 37.4, longitude: 127.1, evidence: "Outlook 일정 변경 확인", sourceUrl: "https://outlook.office.com/calendar" };
    const message = { id: "graph-mail-1", subject: "한빛모빌리티 미팅 장소 변경", preview: "새 주소: 판교역로 235. 확인해 주세요.", receivedAt: "09:12",
        sender: "직원", sourceUrl: "https://outlook.office.com/mail" };
    assert.deepEqual(withLocationEvidence([visit], [message]), [
        { ...visit, evidence: "Outlook 메일 · 한빛모빌리티 미팅 장소 변경", sourceUrl: message.sourceUrl },
    ]);
    assert.deepEqual(withLocationEvidence([visit], [{ ...message, preview: "새 주소: 판교역로 2350" }]), [visit]);
    assert.deepEqual(withLocationEvidence([visit], [{ ...message, subject: "다른 미팅 장소 변경" }]), [visit]);
    assert.deepEqual(withLocationEvidence([visit], [{ ...message, sourceUrl: undefined }]), [visit]);
    assert.deepEqual(withLocationEvidence([visit, visit], [message]), [visit, visit]);
    const unchanged = { ...visit, changedFrom: undefined };
    assert.deepEqual(withLocationEvidence([unchanged], [message]), [unchanged]);
});

test("replaced vehicle session cannot dispatch AI or a OneNote write after a pending calendar read", { timeout: 5_000 }, async t => {
    testEnv(t, { SHIFT_MICROSOFT_CLIENT_ID: "test-client", SHIFT_MICROSOFT_CLIENT_SECRET: "test-secret", SHIFT_MICROSOFT_TENANT: "organizations",
        SHIFT_BRIEFING_URL: "https://briefing.example/summary", SHIFT_BRIEFING_TOKEN: "summary-test" });
    const file = join(mkdtempSync(join(tmpdir(), "shift-workspace-race-")), "workspace.json");
    const employee = `ms:${createHash("sha256").update("guid:test@example.com").digest("hex")}`;
    createWorkspaceStore(file).saveProfile(employee, { ...profileDefaults(employee), aiConsent: true, speakBriefing: true });
    let active = true;
    let nextRead = Promise.withResolvers<void>();
    let finishRead = Promise.withResolvers<void>();
    const effects: string[] = [];
    const upstreamFetch: typeof fetch = async (input, init) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/token")) return Response.json({ access_token: "access", expires_in: 3_600 });
        if (url.pathname === "/v1.0/me") return Response.json({ id: "guid", userPrincipalName: "test@example.com" });
        if (url.pathname.endsWith("/calendarView")) {
            nextRead.resolve();
            await finishRead.promise;
            return Response.json({ value: [{ id: "graph-1", subject: "테스트 일정", start: { dateTime: "2026-11-14T10:30" } }] });
        }
        if (url.pathname.endsWith("/onenote/pages") && init?.method !== "POST") return Response.json({ value: [] });
        effects.push(url.pathname);
        return Response.json(url.hostname === "briefing.example" ? { text: "AI text" } : { id: "note-1" });
    };
    const { server, base } = await setup({ storageFile: file, fetcher: upstreamFetch, active: () => active });
    t.after(() => server.close());
    const connect = await fetch(`${base}/mobile/microsoft/connect`);
    const cookie = requestCookie(connect);
    const csrf = csrfField(await connect.text());
    const consent = await fetch(`${base}/mobile/microsoft/connect`, { method: "POST", headers: { cookie },
        body: new URLSearchParams({ csrf, calendar: "yes", notes: "yes" }), redirect: "manual" });
    const upstream = new URL(consent.headers.get("location")!);
    const callback = await fetch(`${base}/mobile/microsoft/callback?code=code&state=${upstream.searchParams.get("state")}`, { headers: { cookie }, redirect: "manual" });
    assert.equal(callback.status, 303);

    const authorization = { Authorization: `Bearer ${employee}` };
    const workspace = fetch(`${base}${API}`, { headers: authorization });
    await nextRead.promise;
    active = false;
    finishRead.resolve();
    assert.equal((await workspace).status, 401);
    assert.deepEqual(effects, []);

    active = true;
    nextRead = Promise.withResolvers<void>();
    finishRead = Promise.withResolvers<void>();
    const save = () => fetch(`${base}${API}/notes`, { method: "POST", headers: { ...authorization, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: "pending-note", visitId: "graph-1", text: "방문 메모" }) });
    const note = save();
    await nextRead.promise;
    active = false;
    finishRead.resolve();
    assert.equal((await note).status, 401);
    assert.deepEqual(effects, []);

    active = true;
    assert.equal((await save()).status, 201);
    assert.deepEqual(effects, ["/v1.0/me/onenote/pages"]);
});
