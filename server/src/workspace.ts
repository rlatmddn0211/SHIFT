import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { type IncomingMessage, type ServerResponse } from "node:http";
import { createMicrosoftWork, escapeHtml, ProviderError, type MobileIdentity, type WorkData, type WorkPermissions } from "./microsoft-work.ts";
import { createBriefing, createWorkspaceStore, demoData, demoNoteText, profileDefaults, type SavedNote } from "./workspace-data.ts";
import { permissionsPage, profilePage, renderPage } from "./workspace-page.ts";

const API = "/api/vehicles/hyundai-demo-01/workspace";
const MOBILE = "/mobile";
const COOKIE = "shift_workspace";
const HOUR = 3_600_000;
const OPAQUE = /^[A-Za-z0-9_-]{43}$/;
const demoNames = new Map([["employee-a", "직원 A"], ["employee-b", "직원 B"]]);

type Ticket = { identity: MobileIdentity; csrf: string; until: number };
type OAuthAttempt = { verifier: string; permissions: WorkPermissions; returnTo: string; browser: string; until: number; startingIdentity?: string };
type VehicleAuth = string | (() => string | undefined) | undefined;

class InputError extends Error {
    status: number;
    constructor(status: number) {
        super("Invalid request");
        this.status = status;
    }
}

function opaque() { return randomBytes(32).toString("base64url"); }

function equal(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a, b);
}

function cookie(request: IncomingMessage, name: string): string {
    return request.headers.cookie?.split(/;\s*/).find(piece => piece.startsWith(`${name}=`))?.slice(name.length + 1) ?? "";
}

function send(response: ServerResponse, status: number, type: string, body: string) {
    response.writeHead(status, {
        "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://login.microsoftonline.com; base-uri 'none'; frame-ancestors 'none'",
    });
    response.end(body);
}

function json(response: ServerResponse, status: number, value: object) { send(response, status, "application/json", JSON.stringify(value)); }
function html(response: ServerResponse, status: number, html: string) { send(response, status, "text/html", html); }

function redirect(response: ServerResponse, target: string) {
    response.setHeader("Location", target);
    send(response, 303, "text/plain", "");
}

function writeCookie(response: ServerResponse, value: string) {
    const current = response.getHeader("Set-Cookie");
    response.setHeader("Set-Cookie", [...(Array.isArray(current) ? current : current ? [String(current)] : []), value]);
}

async function input(request: IncomingMessage, type: string): Promise<string> {
    if (request.headers["content-type"]?.split(";")[0].trim() !== type) throw new InputError(415);
    if (Number(request.headers["content-length"]) > 16_384) throw new InputError(413);
    let length = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        chunks.push(chunk as Buffer);
        length += chunk.length;
        if (length > 16_384) throw new InputError(413);
    }
    return Buffer.concat(chunks).toString("utf8");
}

function seatNumber(value: string | null): number {
    if (value === null || !/^\d{1,3}$/.test(value) || Number(value) > 100) throw new InputError(400);
    return Number(value);
}

function safeReturn(value: string | null): string {
    return value && /^\/approve\/[A-Za-z0-9_-]{43}$/.test(value) ? value : MOBILE;
}

function noteOutput(note: SavedNote) {
    return { id: note.id, title: note.title, source: note.source, sourceUrl: note.sourceUrl };
}

export function createWorkspace({ publicOrigin, now = Date.now, fetcher = fetch, storageFile,
    enableNavTest = process.env.SHIFT_ENABLE_NAV_TEST === "1" }: {
    publicOrigin: string; now?: () => number; fetcher?: typeof fetch; storageFile?: string; enableNavTest?: boolean;
}) {
    const origin = new URL(publicOrigin).origin;
    const secure = origin.startsWith("https:") ? "; Secure" : "";
    const store = createWorkspaceStore(storageFile);
    const microsoft = createMicrosoftWork(origin, fetcher, now);
    const tickets = new Map<string, Ticket>();
    const authorizations = new Map<string, OAuthAttempt>();
    const oauthBrowsers = new Map<string, number>();
    const pendingNotes = new Map<string, Promise<SavedNote>>();

    function prune<T>(map: Map<string, T>, expiration: (value: T) => number) {
        for (const [key, value] of map) if (expiration(value) <= now()) map.delete(key);
        while (map.size >= 256) map.delete(map.keys().next().value!);
    }

    function setIdentity(response: ServerResponse, identity: MobileIdentity) {
        prune(tickets, ticket => ticket.until);
        const key = opaque();
        tickets.set(key, { identity, csrf: opaque(), until: now() + 8 * HOUR });
        writeCookie(response, `${COOKIE}=${key}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${secure}`);
    }

    function authorizeMobile(response: ServerResponse, employee: string) {
        const name = demoNames.get(employee);
        if (name) setIdentity(response, { id: employee, name });
    }

    function ticketFor(request: IncomingMessage): Ticket | undefined {
        const key = cookie(request, COOKIE);
        const ticket = tickets.get(key);
        if (ticket && ticket.until > now()) return ticket;
        tickets.delete(key);
        return undefined;
    }

    function sourceFor(employee: string) { return employee.startsWith("ms:") ? "microsoft365" as const : "demo" as const; }

    async function rawData(employee: string): Promise<WorkData> {
        return sourceFor(employee) === "demo" ? demoData(employee, enableNavTest) : microsoft.load(employee, store.read(employee).profile);
    }

    async function workspaceData(employee: string) {
        const source = sourceFor(employee);
        const entry = store.read(employee);
        const raw = await rawData(employee);
        const selected = entry.profile;
        const work = {
            visits: raw.visits,
            messages: raw.messages.filter(message => selected.selectedMessages.includes(message.id)),
            notes: raw.notes.filter(note => selected.selectedNotes.includes(note.id)),
        };
        return { ...work, source, profile: {
            seatHeight: selected.seatHeight, seatPosition: selected.seatPosition, speakBriefing: selected.speakBriefing,
        }, briefing: await createBriefing(selected, work, source, fetcher) };
    }

    async function saveNote(employee: string, request: IncomingMessage): Promise<SavedNote> {
        let form: { requestId?: unknown; text?: unknown; visitId?: unknown };
        try { form = JSON.parse(await input(request, "application/json")); }
        catch (error) { if (error instanceof InputError) throw error; throw new InputError(400); }
        if (!form || typeof form.requestId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(form.requestId) ||
            typeof form.text !== "string" || !form.text.trim() || form.text.length > 4_000 ||
            (form.visitId !== undefined && (typeof form.visitId !== "string" || form.visitId.length > 512))) throw new InputError(400);
        const requestId = form.requestId;
        const content = form.text.trim();
        const existing = store.read(employee).notes.find(note => note.requestId === requestId);
        if (existing) return existing;
        const pendingId = `${employee}/${requestId}`;
        const pending = pendingNotes.get(pendingId);
        if (pending) return pending;

        const save = (async () => {
            const source = sourceFor(employee);
            const visit = (await rawData(employee)).visits.find(visit => visit.id === form.visitId);
            const title = visit ? `${visit.title} · 방문 메모` : "방문 메모";
            if (source === "microsoft365" && !store.read(employee).profile.notes) throw new InputError(403);
            const note: SavedNote = source === "demo" ? { id: randomUUID(), title, source, requestId, text: content } :
                { ...await microsoft.saveNote(employee, title, content), source, requestId };
            store.saveNote(employee, note);
            return note;
        })().finally(() => pendingNotes.delete(pendingId));
        pendingNotes.set(pendingId, save);
        return save;
    }

    async function vehicle(request: IncomingMessage, response: ServerResponse, path: string, auth: VehicleAuth) {
        const current = () => typeof auth === "function" ? auth() : auth;
        const employee = current();
        if (!employee) throw new InputError(401);
        if (path === API && request.method === "GET") {
            const result = await workspaceData(employee);
            if (current() !== employee) throw new InputError(401);
            json(response, 200, result);
        } else if (path === `${API}/notes` && request.method === "POST") {
            const note = await saveNote(employee, request);
            if (current() !== employee) throw new InputError(401);
            json(response, 201, noteOutput(note));
        } else if (path.startsWith(`${API}/notes/`) && request.method === "GET") {
            const id = decodeURIComponent(path.slice(`${API}/notes/`.length));
            const profile = store.read(employee).profile;
            const selected = (await rawData(employee)).notes.find(note => note.id === id && profile.selectedNotes.includes(id));
            if (!selected) throw new InputError(404);
            const content = sourceFor(employee) === "demo" ? demoNoteText(id) :
                (await microsoft.notePage(employee, id)).replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 4_000);
            if (current() !== employee) throw new InputError(401);
            json(response, 200, { id, title: selected.title, text: content, sourceUrl: selected.sourceUrl });
        } else {
            throw new InputError(404);
        }
    }

    async function mobile(request: IncomingMessage, response: ServerResponse, target: URL) {
        const path = target.pathname;
        const ticket = ticketFor(request);
        if (path === `${MOBILE}/microsoft/connect`) {
            if (request.method === "GET") {
                const previous = cookie(request, "shift_oauth_browser");
                prune(oauthBrowsers, until => until);
                const browser = oauthBrowsers.has(previous) ? previous : opaque();
                oauthBrowsers.set(browser, now() + 5 * 60_000);
                writeCookie(response, `shift_oauth_browser=${browser}; HttpOnly; SameSite=Lax; Path=/mobile/microsoft; Max-Age=300${secure}`);
                html(response, 200, permissionsPage(microsoft.configured, safeReturn(target.searchParams.get("returnTo")), browser));
            } else if (request.method === "POST") {
                const fields = new URLSearchParams(await input(request, "application/x-www-form-urlencoded"));
                const browser = cookie(request, "shift_oauth_browser");
                if ((oauthBrowsers.get(browser) ?? 0) <= now() || !equal(fields.get("csrf") ?? "", browser)) throw new InputError(403);
                const permissions = { calendar: fields.has("calendar"), mail: fields.has("mail"), notes: fields.has("notes") };
                const auth = microsoft.authorize(permissions);
                prune(authorizations, attempt => attempt.until);
                authorizations.set(auth.state, { verifier: auth.verifier, permissions, returnTo: safeReturn(fields.get("returnTo")),
                    browser, until: now() + 5 * 60_000, startingIdentity: ticket?.identity.id });
                redirect(response, auth.url);
            } else throw new InputError(405);
            return;
        }
        if (path === `${MOBILE}/microsoft/callback` && request.method === "GET") {
            const state = target.searchParams.get("state") ?? "";
            const attempt = authorizations.get(state);
            const browser = cookie(request, "shift_oauth_browser");
            if (!attempt || attempt.until <= now() || !equal(attempt.browser, browser)) throw new InputError(403);
            authorizations.delete(state);
            const code = target.searchParams.get("code");
            if (!code) {
                html(response, 400, renderPage("업무 계정 연결 취소", `<a href="${escapeHtml(attempt.returnTo)}">돌아가기</a>`));
                return;
            }
            const identity = await microsoft.connect(code, attempt.verifier);
            const previousProfile = store.read(identity.id).profile;
            store.saveProfile(identity.id, { ...previousProfile, ...attempt.permissions,
                selectedCalendars: attempt.permissions.calendar && (previousProfile.selectedCalendars || attempt.startingIdentity !== identity.id),
                selectedMessages: attempt.permissions.mail ? previousProfile.selectedMessages : [],
                selectedNotes: attempt.permissions.notes ? previousProfile.selectedNotes : [],
            });
            tickets.delete(cookie(request, COOKIE));
            setIdentity(response, identity);
            redirect(response, attempt.returnTo);
            return;
        }
        if (!ticket) {
            html(response, 401, renderPage("업무·개인 설정", "<p>차량의 SHIFT QR에서 로그인한 후 열 수 있습니다.</p>"));
            return;
        }
        const employee = ticket.identity.id;
        if (request.method === "POST") {
            const form = new URLSearchParams(await input(request, "application/x-www-form-urlencoded"));
            if (!equal(form.get("csrf") ?? "", ticket.csrf) || ticketFor(request) !== ticket) throw new InputError(403);
            if (path === `${MOBILE}/microsoft/disconnect` && sourceFor(employee) === "microsoft365") {
                microsoft.disconnect(employee);
                store.clearMicrosoftNotes(employee);
                store.saveProfile(employee, { ...profileDefaults(employee), seatHeight: store.read(employee).profile.seatHeight,
                    seatPosition: store.read(employee).profile.seatPosition });
                for (const [key, active] of tickets) if (active.identity.id === employee) tickets.delete(key);
                writeCookie(response, `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure}`);
                html(response, 200, renderPage("업무 계정 연결 해제", "<p>SHIFT에서 저장한 연결 정보가 정리됐습니다.</p>"));
                return;
            }
            if (path !== MOBILE) throw new InputError(404);
            const seatHeight = seatNumber(form.get("seatHeight"));
            const seatPosition = seatNumber(form.get("seatPosition"));
            const raw = await rawData(employee);
            if (ticketFor(request) !== ticket) throw new InputError(403);
            const old = store.read(employee).profile;
            store.saveProfile(employee, { ...old, seatHeight, seatPosition, speakBriefing: form.has("speakBriefing"),
                selectedCalendars: form.has("selectedCalendars"), aiConsent: form.has("aiConsent"),
                selectedMessages: raw.messages.filter(item => form.getAll("message").includes(item.id)).map(item => item.id),
                selectedNotes: raw.notes.filter(item => form.getAll("note").includes(item.id)).map(item => item.id) });
            redirect(response, `${MOBILE}?saved=1`);
            return;
        }
        if (request.method !== "GET") throw new InputError(405);
        if (path === `${MOBILE}/notes`) {
            const items = store.read(employee).notes.map(note => `<li><strong>${escapeHtml(note.title)}</strong>
                ${note.sourceUrl ? `<p><a href="${escapeHtml(note.sourceUrl)}" rel="noreferrer">OneNote에서 열기</a></p>` : ""}
                ${note.text ? `<pre>${escapeHtml(note.text)}</pre>` : ""}</li>`).join("");
            html(response, 200, renderPage("내 방문 메모", `${items ? `<ul>${items}</ul>` : "<p>저장한 방문 메모가 없습니다.</p>"}<a href="/mobile">업무·개인 설정</a>`));
            return;
        }
        if (path !== MOBILE) throw new InputError(404);
        const data = await rawData(employee);
        if (ticketFor(request) !== ticket) throw new InputError(403);
        html(response, 200, profilePage({ identity: ticket.identity, profile: store.read(employee).profile, work: data,
            csrf: ticket.csrf, configured: microsoft.configured, notice: target.searchParams.has("saved") ? "설정을 저장했습니다." : undefined }));
    }

    async function handle(request: IncomingMessage, response: ServerResponse, path: string, auth: VehicleAuth) {
        const isVehicle = path === API || path.startsWith(`${API}/`);
        if (!isVehicle && path !== MOBILE && !path.startsWith(`${MOBILE}/`)) return false;
        try {
            if (isVehicle) await vehicle(request, response, path, auth);
            else await mobile(request, response, new URL(request.url ?? "/mobile", origin));
        } catch (error) {
            if (response.destroyed || response.headersSent) return true;
            const status = error instanceof InputError ? error.status : error instanceof ProviderError ? 502 : 500;
            if (status === 413) { response.setHeader("Connection", "close"); request.resume(); }
            if (isVehicle) json(response, status, { error: status === 502 ? "microsoft365_unavailable" : "workspace_request_failed" });
            else html(response, status, renderPage(status === 502 ? "업무 계정 다시 연결" : "요청을 처리하지 못했습니다",
                status === 502 ? '<p>Microsoft 365 계정 또는 권한을 확인하세요.</p><a href="/mobile/microsoft/connect">계정 연결</a>' : '<a href="/mobile">업무·개인 설정</a>'));
        }
        return true;
    }

    return { authorizeMobile, handle, microsoftConfigured: microsoft.configured,
        mobileIdentity: (request: IncomingMessage) => OPAQUE.test(cookie(request, COOKIE)) ? ticketFor(request)?.identity : undefined,
        mobileEmployee: (request: IncomingMessage) => ticketFor(request)?.identity.id };
}
