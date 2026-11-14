import { randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";
import { approvalPage, employees } from "./approval-page.ts";
import { servePhoneAsset, writePhonePage } from "./mobile-web.ts";
import { createWorkspace } from "./workspace.ts";

const LOGIN_TTL_MS = 2 * 60_000;
const SESSION_TTL_MS = 8 * 60 * 60_000;
const TERMINAL_RETENTION_MS = 5 * 60_000;
const MAX_REQUESTS = 256;
const MAX_ATTEMPTS = 5;
const VEHICLE_ID = "hyundai-demo-01";
const VEHICLE_NAME = "현대 공용차 01";
const OPAQUE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

type LoginStatus = "pending" | "approved" | "expired" | "locked" | "replaced";
type LoginRequest = {
    id: string;
    approvalToken: string;
    pin: string;
    expiresAt: number;
    attempts: number;
    status: LoginStatus;
    sessionToken?: string;
    employeeName?: string;
};
type Session = {
    token: string;
    requestId: string;
    employeeId: string;
    employeeName: string;
    expiresAt: number;
};
type LogoutStatus = "pending" | "approved" | "expired" | "replaced";
type LogoutRequest = {
    id: string;
    approvalToken: string;
    sessionToken: string;
    employeeId: string;
    employeeName: string;
    expiresAt: number;
    status: LogoutStatus;
};
type ApprovalView = Omit<Parameters<typeof approvalPage>[0], "purpose"> & {
    kind: "approval" | "logout";
    status: LoginStatus | "not-found" | "login-required";
};

class HttpError extends Error {
    status: number;

    constructor(status: number) {
        super(`HTTP ${status}`);
        this.status = status;
    }
}

function originFrom(value: string): string {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password ||
        parsed.search || parsed.hash || parsed.pathname !== "/") {
        throw new Error("SHIFT_PUBLIC_ORIGIN must be an HTTP(S) origin without a path, query or credentials.");
    }
    return parsed.origin;
}

function token(): string {
    return randomBytes(32).toString("base64url");
}

function bearerFrom(request: IncomingMessage): string | undefined {
    return request.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i)?.[1];
}

function sameToken(first: string | undefined, second: string): boolean {
    return first !== undefined && OPAQUE_TOKEN.test(first) &&
        timingSafeEqual(Buffer.from(first), Buffer.from(second));
}

function send(response: ServerResponse, status: number, type: string, body: string): void {
    response.writeHead(status, {
        "Content-Type": `${type}; charset=utf-8`,
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
    });
    response.end(body);
}

function json(response: ServerResponse, status: number, body: object): void {
    send(response, status, "application/json", JSON.stringify(body));
}

async function phonePage(request: IncomingMessage, response: ServerResponse, status: number, page: ApprovalView): Promise<void> {
    const demoEmployees = page.kind === "approval" && page.action && !page.accountName
        ? Array.from(employees, ([id, name]) => ({ id, name })) : undefined;
    if (await writePhonePage(request, response, status, { ...page, employees: demoEmployees })) return;
    response.setHeader("Vary", "Accept");
    send(response, status, "text/html", approvalPage({ ...page, purpose: page.kind === "logout" ? "logout" : undefined }));
}

async function readForm(request: IncomingMessage): Promise<URLSearchParams> {
    if (request.headers["content-type"]?.split(";")[0].trim() !== "application/x-www-form-urlencoded") {
        throw new HttpError(415);
    }
    if (Number(request.headers["content-length"]) > 1024) throw new HttpError(413);
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
        chunks.push(chunk as Buffer);
        bytesRead += chunk.length;
        if (bytesRead > 1024) throw new HttpError(413);
    }
    return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

export function createShiftServer({ publicOrigin, now = Date.now, storageFile }: {
    publicOrigin: string;
    now?: () => number;
    storageFile?: string;
}) {
    const origin = originFrom(publicOrigin);
    const requests = new Map<string, LoginRequest>();
    const approvalIds = new Map<string, string>();
    const logoutRequests = new Map<string, LogoutRequest>();
    const logoutApprovalIds = new Map<string, string>();
    const workspace = createWorkspace({ publicOrigin: origin, now, storageFile });
    let activeSession: Session | undefined;
    let pendingId: string | undefined;

    function activeFor(request: IncomingMessage): Session | undefined {
        if (activeSession && activeSession.expiresAt > now() && sameToken(bearerFrom(request), activeSession.token)) {
            return activeSession;
        }
    }

    function statusOf(login: LoginRequest): LoginStatus {
        if (login.status === "pending" && login.expiresAt <= now()) return "expired";
        if (login.status === "approved") {
            if (!activeSession || activeSession.requestId !== login.id) return "replaced";
            if (activeSession.expiresAt <= now()) return "expired";
        }
        return login.status;
    }

    function forget(login: LoginRequest): void {
        requests.delete(login.id);
        approvalIds.delete(login.approvalToken);
    }

    function prune(): void {
        const keepAfter = now() - TERMINAL_RETENTION_MS;
        for (const login of requests.values()) {
            const status = statusOf(login);
            if (status === "pending" || status === "approved") continue;
            if (login.expiresAt <= keepAfter || requests.size >= MAX_REQUESTS) forget(login);
        }
    }

    function createLogin(response: ServerResponse): void {
        const previous = pendingId && requests.get(pendingId);
        if (previous && statusOf(previous) === "pending") previous.status = "replaced";
        prune();
        const login: LoginRequest = {
            id: token(),
            approvalToken: token(),
            pin: randomInt(0, 1_000_000).toString().padStart(6, "0"),
            expiresAt: now() + LOGIN_TTL_MS,
            attempts: 0,
            status: "pending",
        };
        pendingId = login.id;
        requests.set(login.id, login);
        approvalIds.set(login.approvalToken, login.id);
        json(response, 201, {
            requestId: login.id,
            approvalUrl: `${origin}/approve/${login.approvalToken}`,
            pin: login.pin,
            expiresAt: login.expiresAt,
        });
    }

    function logoutStatus(logout: LogoutRequest): LogoutStatus {
        if (logout.status !== "pending") return logout.status;
        if (logout.expiresAt <= now()) return "expired";
        if (activeSession?.token !== logout.sessionToken) return "replaced";
        if (activeSession.expiresAt <= now()) return "expired";
        return "pending";
    }

    function createLogout(response: ServerResponse, session: Session): void {
        const keepAfter = now() - TERMINAL_RETENTION_MS;
        for (const logout of logoutRequests.values()) {
            if (logoutStatus(logout) === "pending") logout.status = "replaced";
            if (logout.expiresAt <= keepAfter || logoutRequests.size >= MAX_REQUESTS) {
                logoutRequests.delete(logout.id);
                logoutApprovalIds.delete(logout.approvalToken);
            }
        }
        const logout: LogoutRequest = {
            id: token(), approvalToken: token(), sessionToken: session.token,
            employeeId: session.employeeId, employeeName: session.employeeName,
            expiresAt: now() + LOGIN_TTL_MS, status: "pending",
        };
        logoutRequests.set(logout.id, logout);
        logoutApprovalIds.set(logout.approvalToken, logout.id);
        json(response, 201, {
            requestId: logout.id, approvalUrl: `${origin}/logout/${logout.approvalToken}`, expiresAt: logout.expiresAt,
        });
    }

    function approvalState(request: IncomingMessage, response: ServerResponse, status: Exclude<LoginStatus, "pending">,
        replay: boolean): Promise<void> {
        const page = { kind: "approval" as const, status, vehicleName: VEHICLE_NAME };
        switch (status) {
            case "approved":
                return phonePage(request, response, replay ? 409 : 200, {
                    ...page, title: "승인 완료",
                    notice: "차량의 SHIFT 화면에서 오늘 방문 업무를 확인하세요.",
                    profileUrl: "/mobile",
                });
            case "locked":
                return phonePage(request, response, 429, {
                    ...page, title: "PIN 입력 횟수 초과",
                    notice: "차량 화면에서 새 QR을 열고 다시 스캔하세요.",
                });
            case "expired":
                return phonePage(request, response, 410, {
                    ...page, title: "로그인 요청 만료",
                    notice: "차량 화면에서 새 QR을 열고 다시 스캔하세요.",
                });
            case "replaced":
                return phonePage(request, response, 409, {
                    ...page, title: "새 로그인 요청이 열렸습니다",
                    notice: "차량 화면에 표시된 QR을 다시 스캔하세요.",
                });
        }
    }

    async function handleApproval(request: IncomingMessage, response: ServerResponse, approvalToken: string): Promise<void> {
        const requestId = approvalIds.get(approvalToken);
        const login = requestId && requests.get(requestId);
        if (!login) {
            return phonePage(request, response, 404, {
                kind: "approval", status: "not-found", title: "로그인 요청을 찾을 수 없습니다",
                notice: "차량 화면의 QR을 다시 스캔하세요.",
            });
        }
        const initialStatus = statusOf(login);
        if (initialStatus !== "pending") {
            return approvalState(request, response, initialStatus, request.method === "POST");
        }
        const mobile = workspace.mobileIdentity(request);
        const microsoftAccount = mobile?.id.startsWith("ms:") ? mobile : undefined;
        const action = `/approve/${approvalToken}`;
        const formPage: ApprovalView = {
            kind: "approval", status: "pending",
            title: "차량 로그인 승인",
            vehicleName: VEHICLE_NAME,
            notice: "차량을 확인하고 화면에 표시된 PIN을 입력하세요.",
            action, accountName: microsoftAccount?.name,
            connectUrl: workspace.microsoftConfigured ? `/mobile/microsoft/connect?returnTo=${encodeURIComponent(action)}` : undefined,
        };
        if (request.method === "GET") {
            return phonePage(request, response, 200, formPage);
        }

        const form = await readForm(request);
        // A concurrent approval or vehicle retry can change the request while its body is read.
        const status = statusOf(login);
        if (status !== "pending") {
            return approvalState(request, response, status, true);
        }
        const employee = microsoftAccount?.id ?? form.get("employee") ?? "";
        const employeeName = microsoftAccount?.name ?? employees.get(employee);
        const submittedPin = form.get("pin") ?? "";
        if (!employeeName || !/^\d{6}$/.test(submittedPin) ||
            !timingSafeEqual(Buffer.from(login.pin), Buffer.from(submittedPin))) {
            login.attempts++;
            if (login.attempts === MAX_ATTEMPTS) {
                login.status = "locked";
                return approvalState(request, response, "locked", false);
            }
            return phonePage(request, response, 400, {
                ...formPage, selectedEmployee: employees.has(employee) ? employee : undefined,
                error: "차량 화면의 PIN과 계정을 확인하세요.",
            });
        }

        const previous = activeSession && requests.get(activeSession.requestId);
        if (previous) previous.status = "replaced";
        activeSession = { token: token(), requestId: login.id, employeeId: employee, employeeName, expiresAt: now() + SESSION_TTL_MS };
        login.status = "approved";
        login.sessionToken = activeSession.token;
        login.employeeName = employeeName;
        workspace.authorizeMobile(response, employee);
        response.setHeader("Location", action);
        send(response, 303, "text/plain", "");
    }

    async function handleLogout(request: IncomingMessage, response: ServerResponse, approvalToken: string): Promise<void> {
        const id = logoutApprovalIds.get(approvalToken);
        const logout = id && logoutRequests.get(id);
        const page = { kind: "logout" as const, vehicleName: VEHICLE_NAME };
        if (!logout) {
            return phonePage(request, response, 404, {
                ...page, status: "not-found", title: "종료 요청을 찾을 수 없습니다",
                notice: "차량 화면에서 새 QR을 스캔하세요.",
            });
        }
        const status = logoutStatus(logout);
        if (status === "expired" || status === "replaced") {
            return phonePage(request, response, status === "expired" ? 410 : 409, {
                ...page, status, title: status === "expired" ? "종료 요청 만료" : "종료 요청이 취소되었습니다",
                notice: "차량 화면에서 새 QR을 스캔하세요.",
            });
        }
        if (workspace.mobileEmployee(request) !== logout.employeeId) {
            return phonePage(request, response, 403, {
                ...page, status: "login-required", title: "차량 로그인에 사용한 휴대폰이 필요합니다",
                notice: "같은 브라우저에서 QR을 다시 스캔하세요.",
            });
        }
        if (status === "approved") {
            return phonePage(request, response, request.method === "POST" ? 409 : 200, {
                ...page, status, title: "로그아웃 완료", notice: "차량에서 개인 업무가 닫혔습니다.",
            });
        }
        const action = `/logout/${approvalToken}`;
        if (request.method === "GET") {
            return phonePage(request, response, 200, {
                ...page, status, title: "차량 로그아웃 승인", accountName: logout.employeeName,
                notice: `${logout.employeeName}의 차량 업무를 종료합니다.`, action,
            });
        }
        logout.status = "approved";
        activeSession = undefined;
        response.setHeader("Location", action);
        send(response, 303, "text/plain", "");
    }

    async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
        const path = new URL(request.url ?? "/", origin).pathname;
        const method = request.method;
        if (method === "POST" && request.headers["sec-fetch-site"] === "cross-site") {
            throw new HttpError(403);
        }
        if (await servePhoneAsset(request, response)) return;
        if (await workspace.handle(request, response, path, () => activeFor(request)?.employeeId)) return;
        if (method === "GET" && path === "/health") {
            json(response, 200, { ok: true });
            return;
        }
        const vehicleApi = `/api/vehicles/${VEHICLE_ID}`;
        const loginRequests = `${vehicleApi}/login-requests`;
        const logouts = `${vehicleApi}/logout-requests`;
        if (method === "POST" && path === loginRequests) {
            createLogin(response);
            return;
        }
        if ((method === "GET" || method === "DELETE") && path.startsWith(`${loginRequests}/`)) {
            const login = requests.get(path.slice(loginRequests.length + 1));
            if (!login) {
                json(response, 404, { status: "expired" });
                return;
            }
            if (method === "DELETE" && statusOf(login) === "pending") login.status = "replaced";
            const status = statusOf(login);
            const session = status === "approved" ? { sessionToken: login.sessionToken, employeeName: login.employeeName } : {};
            json(response, 200, { status, ...session });
            return;
        }
        if (method === "GET" && path === `${vehicleApi}/session`) {
            const session = activeFor(request);
            if (!session) {
                json(response, 401, { error: "session_inactive" });
                return;
            }
            json(response, 200, { employeeName: session.employeeName });
            return;
        }
        if (method === "POST" && path === logouts) {
            const session = activeFor(request);
            if (session) createLogout(response, session);
            else json(response, 401, { error: "session_inactive" });
            return;
        }
        if ((method === "GET" || method === "DELETE") && path.startsWith(`${logouts}/`)) {
            const logout = logoutRequests.get(path.slice(logouts.length + 1));
            if (!logout || !sameToken(bearerFrom(request), logout.sessionToken)) {
                json(response, 404, { error: "not_found" });
                return;
            }
            if (method === "DELETE" && logoutStatus(logout) === "pending") logout.status = "replaced";
            json(response, 200, { status: logoutStatus(logout) });
            return;
        }
        const approvalToken = path.startsWith("/approve/") ? path.slice("/approve/".length) : "";
        if ((method === "GET" || method === "POST") && OPAQUE_TOKEN.test(approvalToken)) {
            await handleApproval(request, response, approvalToken);
            return;
        }
        const logoutToken = path.startsWith("/logout/") ? path.slice("/logout/".length) : "";
        if ((method === "GET" || method === "POST") && OPAQUE_TOKEN.test(logoutToken)) {
            await handleLogout(request, response, logoutToken);
            return;
        }
        json(response, 404, { error: "not_found" });
    }

    return createServer({ requestTimeout: 15_000, headersTimeout: 10_000 }, (request, response) => {
        handle(request, response).catch((error: unknown) => {
            if (response.destroyed || response.headersSent) return;
            const status = error instanceof HttpError ? error.status : 500;
            if (status === 413) {
                response.setHeader("Connection", "close");
                request.resume();
            }
            json(response, status, { error: status === 500 ? "internal_error" : "invalid_request" });
        });
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const port = Number(process.env.PORT ?? 8787);
    const host = process.env.SHIFT_BIND_HOST ?? "127.0.0.1";
    const publicOrigin = process.env.SHIFT_PUBLIC_ORIGIN ?? `http://127.0.0.1:${port}`;
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a TCP port.");
    createShiftServer({ publicOrigin }).listen(port, host, () => {
        console.log(`SHIFT demo server listening on ${host}:${port}`);
    });
}
