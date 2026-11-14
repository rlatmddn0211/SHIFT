import { createHash, randomBytes } from "node:crypto";

export type Visit = {
    id: string; time: string; title: string; address: string; latitude?: number; longitude?: number;
    poiId?: string; poiName?: string;
    changedFrom?: string; previousTime?: string; evidence?: string; sourceUrl?: string;
};
export type Message = { id: string; subject: string; preview: string; receivedAt: string; sender: string; sourceUrl?: string };
export type Note = { id: string; title: string; sourceUrl?: string };
export type WorkData = { visits: Visit[]; messages: Message[]; notes: Note[] };
export type WorkPermissions = { calendar: boolean; mail: boolean; notes: boolean };
export type MobileIdentity = { id: string; name: string };
type Fetcher = typeof globalThis.fetch;
type TokenSet = { access: string; refresh?: string; expiresAt: number };
type Authorization = { url: string; state: string; verifier: string };
type GraphEvent = {
    id: string; subject?: string; start: { dateTime: string }; isAllDay?: boolean; isCancelled?: boolean;
    location?: { displayName?: string; address?: { street?: string; city?: string; postalCode?: string }; coordinates?: { latitude?: number; longitude?: number } };
    webLink?: string;
};
type GraphMessage = {
    id: string; subject?: string; bodyPreview?: string; receivedDateTime: string; importance?: string;
    isRead?: boolean; from?: { emailAddress?: { name?: string } }; webLink?: string;
};
type GraphNote = { id: string; title?: string; links?: { oneNoteWebUrl?: { href?: string } } };

export class ProviderError extends Error {
    status: number;
    constructor(status: number) {
        super("Microsoft 365 요청을 완료하지 못했습니다.");
        this.status = status;
    }
}

const GRAPH = "https://graph.microsoft.com/v1.0";
const DAY = 86_400_000;
const SEOUL_OFFSET = 9 * 3_600_000;

export function text(input: string | undefined, size = 240): string {
    return (input ?? "").replace(/\s+/g, " ").trim().slice(0, size);
}

export function escapeHtml(value: string): string {
    const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return value.replace(/[&<>"']/g, character => entities[character]);
}

export function safeLink(value: string | undefined): string | undefined {
    if (!value) return undefined;
    try {
        const url = new URL(value);
        if (url.protocol === "https:" && !url.username && !url.password) return url.href;
    } catch { /* Malformed provider link. */ }
    return undefined;
}

function query(path: string, values: Record<string, string>) {
    return `${path}?${new URLSearchParams(values)}`;
}

function scopes(permissions: WorkPermissions): string {
    return ["offline_access", "User.Read", ...(permissions.calendar ? ["Calendars.Read"] : []),
        ...(permissions.mail ? ["Mail.Read"] : []), ...(permissions.notes ? ["Notes.ReadWrite"] : [])].join(" ");
}

export function createMicrosoftWork(publicOrigin: string, fetcher: Fetcher, now: () => number) {
    const clientId = process.env.SHIFT_MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.SHIFT_MICROSOFT_CLIENT_SECRET;
    const tenant = process.env.SHIFT_MICROSOFT_TENANT ?? "organizations";
    const callbackOrigin = new URL(publicOrigin);
    const secureCallback = callbackOrigin.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(callbackOrigin.hostname);
    const configured = Boolean(clientId && clientSecret && secureCallback && /^[A-Za-z0-9.-]+$/.test(tenant));
    const identityBase = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
    const redirect = `${publicOrigin}/mobile/microsoft/callback`;
    const clients = new Map<string, TokenSet>();
    const refreshing = new Map<string, Promise<string>>();
    const previousVisits = new Map<string, { day: number; visits: Map<string, Visit> }>();

    function authorize(permissions: WorkPermissions): Authorization {
        if (!configured) throw new ProviderError(503);
        const state = randomBytes(32).toString("base64url");
        const verifier = randomBytes(48).toString("base64url");
        const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
        const url = query(`${identityBase}/authorize`, {
            client_id: clientId!, response_type: "code", redirect_uri: redirect,
            response_mode: "query", scope: scopes(permissions), state,
            code_challenge: codeChallenge, code_challenge_method: "S256",
        });
        return { url, state, verifier };
    }

    async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
        const response = await fetcher(url, { ...init, redirect: "error", signal: AbortSignal.timeout(8_000) });
        if (!response.ok) throw new ProviderError(response.status);
        return await response.json() as T;
    }

    async function redeem(form: Record<string, string>, priorRefresh?: string): Promise<TokenSet> {
        const output = await fetchJson<{ access_token: string; refresh_token?: string; expires_in: number }>(`${identityBase}/token`, {
            method: "POST",
            body: new URLSearchParams({ client_id: clientId!, client_secret: clientSecret!, redirect_uri: redirect, ...form }),
        });
        if (!output.access_token || !Number.isFinite(output.expires_in)) throw new ProviderError(502);
        return { access: output.access_token, refresh: output.refresh_token ?? priorRefresh, expiresAt: now() + output.expires_in * 1000 };
    }

    async function accessFor(identity: string): Promise<string> {
        const stored = clients.get(identity);
        if (!stored) throw new ProviderError(401);
        if (stored.expiresAt - now() > 60_000) return stored.access;
        if (!stored.refresh) throw new ProviderError(401);
        const pending = refreshing.get(identity);
        if (pending) return pending;
        const renewal = redeem({ grant_type: "refresh_token", refresh_token: stored.refresh }, stored.refresh).then(token => {
            if (clients.get(identity) !== stored) throw new ProviderError(401);
            clients.set(identity, token);
            return token.access;
        }).finally(() => refreshing.delete(identity));
        refreshing.set(identity, renewal);
        return renewal;
    }

    function graph<T>(token: string, path: string, init: RequestInit = {}) {
        const headers = new Headers(init.headers);
        headers.set("Authorization", `Bearer ${token}`);
        headers.set("Accept", "application/json");
        return fetchJson<T>(`${GRAPH}${path}`, { ...init, headers });
    }

    async function connect(code: string, verifier: string): Promise<MobileIdentity> {
        if (!configured) throw new ProviderError(503);
        const current = await redeem({ grant_type: "authorization_code", code, code_verifier: verifier });
        const me = await graph<{ id?: string; displayName?: string; userPrincipalName?: string }>(current.access,
            "/me?$select=id,displayName,userPrincipalName");
        if (!me.id) throw new ProviderError(502);
        const id = `ms:${createHash("sha256").update(`${me.id}:${me.userPrincipalName ?? ""}`).digest("hex")}`;
        clients.set(id, current);
        return { id, name: text(me.displayName, 40) || "업무 계정" };
    }

    async function load(identity: string, permissions: WorkPermissions): Promise<WorkData> {
        const access = await accessFor(identity);
        const start = Math.floor((now() + SEOUL_OFFSET) / DAY) * DAY - SEOUL_OFFSET;
        const [events, messages, notes] = await Promise.all([
            permissions.calendar ? graph<{ value: GraphEvent[] }>(access, query("/me/calendarView", {
                startDateTime: new Date(start).toISOString(), endDateTime: new Date(start + DAY).toISOString(),
                "$select": "id,subject,start,location,webLink,isCancelled,isAllDay", "$top": "50", "$orderby": "start/dateTime",
            }), { headers: { Prefer: 'outlook.timezone="Korea Standard Time"' } }) : { value: [] },
            permissions.mail ? graph<{ value: GraphMessage[] }>(access, query("/me/messages", {
                "$filter": `receivedDateTime ge ${new Date(now() - 7 * DAY).toISOString()}`,
                "$select": "id,subject,bodyPreview,receivedDateTime,importance,isRead,from,webLink",
                "$orderby": "receivedDateTime desc", "$top": "30",
            })) : { value: [] },
            permissions.notes ? graph<{ value: GraphNote[] }>(access, "/me/onenote/pages?$top=20") : { value: [] },
        ]);

        const eventsForToday = events.value.filter(event => !event.isCancelled && !event.isAllDay).map(event => {
                const location = event.location;
                const street = text(location?.address?.street);
                const address = street ? [text(location?.address?.city), street].filter(Boolean).join(" ") : text(location?.displayName);
                const lat = location?.coordinates?.latitude;
                const lon = location?.coordinates?.longitude;
                const valid = typeof lat === "number" && typeof lon === "number" && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
                return { id: event.id, time: event.start.dateTime.slice(11, 16), title: text(event.subject, 150) || "방문 일정",
                    address, ...(valid ? { latitude: lat, longitude: lon } : {}), sourceUrl: safeLink(event.webLink) };
        });
        const previous = previousVisits.get(identity);
        const known = previous?.day === start ? previous.visits : new Map<string, Visit>();
        const visits = eventsForToday.map(visit => {
            const old = known.get(visit.id);
            if (!old) return visit;
            const changedFrom = old.address && old.address !== visit.address ? old.address : old.changedFrom;
            const previousTime = old.time && old.time !== visit.time ? old.time : old.previousTime;
            const evidence = changedFrom || previousTime ? "Outlook 일정 변경 확인" : undefined;
            return { ...visit, changedFrom, previousTime, evidence };
        });
        if (permissions.calendar) previousVisits.set(identity, { day: start, visits: new Map(visits.map(visit => [visit.id, visit])) });

        return {
            visits,
            messages: messages.value.filter(message => message.importance === "high" || message.isRead === false).map(message => ({
                id: message.id, subject: text(message.subject, 150) || "업무 메일", preview: text(message.bodyPreview, 400),
                receivedAt: message.receivedDateTime, sender: text(message.from?.emailAddress?.name, 100), sourceUrl: safeLink(message.webLink),
            })),
            notes: notes.value.map(note => ({ id: note.id, title: text(note.title, 150) || "OneNote 메모", sourceUrl: safeLink(note.links?.oneNoteWebUrl?.href) })),
        };
    }

    async function saveNote(identity: string, title: string, content: string): Promise<Note> {
        const access = await accessFor(identity);
        const section = process.env.SHIFT_ONENOTE_SECTION ?? "SHIFT 방문 메모";
        const result = await graph<GraphNote>(access, query("/me/onenote/pages", { sectionName: section }), {
            method: "POST", headers: { "Content-Type": "text/html; charset=utf-8" },
            body: `<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><p>${escapeHtml(content).replaceAll("\n", "<br>")}</p></body></html>`,
        });
        return { id: result.id, title: text(result.title, 150) || title, sourceUrl: safeLink(result.links?.oneNoteWebUrl?.href) };
    }

    async function notePage(identity: string, id: string): Promise<string> {
        const access = await accessFor(identity);
        const url = `${GRAPH}/me/onenote/pages/${encodeURIComponent(id)}/content`;
        const response = await fetcher(url, { headers: { Authorization: `Bearer ${access}` }, redirect: "error", signal: AbortSignal.timeout(8_000) });
        if (!response.ok) throw new ProviderError(response.status);
        return (await response.text()).slice(0, 70_000);
    }

    return { configured, authorize, connect, load, saveNote, notePage, disconnect(identity: string) {
        clients.delete(identity);
        previousVisits.delete(identity);
    } };
}
