import { readFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";

export type PhonePage = {
    kind: "approval" | "logout" | "notes";
    title: string;
    [key: string]: unknown;
};

const defaultDist = new URL("../../webapp/dist/", import.meta.url);
const assetPrefix = "/shift-phone-assets/";
const assetPath = /^assets\/[A-Za-z0-9][A-Za-z0-9._-]*-[A-Za-z0-9_-]{8,}\.(js|css|woff2|svg)$/;
const assetTypes = new Map([
    ["js", "text/javascript; charset=utf-8"], ["css", "text/css; charset=utf-8"],
    ["woff2", "font/woff2"], ["svg", "image/svg+xml"],
]);
const commonHeaders = { "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
const shellPolicy = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'";

function accepts(request: IncomingMessage, type: string): boolean {
    return request.headers.accept?.split(",").some(value => {
        const [media, ...parameters] = value.toLowerCase().split(";").map(part => part.trim());
        if (media !== type) return false;
        const quality = parameters.find(part => /^q\s*=/.test(part));
        return quality === undefined || Number(quality.split("=")[1]) > 0;
    }) ?? false;
}

async function readBuiltFile(buildDirectory: URL, name: string): Promise<Buffer | undefined> {
    try {
        return await readFile(new URL(name, buildDirectory));
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "ENOENT" || code === "ENOTDIR") return undefined;
        throw error;
    }
}

export async function writePhonePage(request: IncomingMessage, response: ServerResponse, status: number, page: PhonePage,
    buildDirectory = defaultDist): Promise<boolean> {
    if (accepts(request, "application/json")) {
        response.writeHead(status, { ...commonHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
            Vary: "Accept", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" });
        response.end(JSON.stringify(page));
        return true;
    }
    if (request.method !== "GET" || !accepts(request, "text/html")) return false;
    const index = await readBuiltFile(buildDirectory, "index.html");
    if (!index) return false;
    response.writeHead(status, { ...commonHeaders, "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store",
        Vary: "Accept", "Content-Security-Policy": shellPolicy });
    response.end(index);
    return true;
}

export async function servePhoneAsset(request: IncomingMessage, response: ServerResponse, buildDirectory = defaultDist): Promise<boolean> {
    const path = request.url?.split("?", 1)[0] ?? "";
    if (!path.startsWith(assetPrefix)) return false;
    if (request.method !== "GET" && request.method !== "HEAD") {
        response.writeHead(405, { ...commonHeaders, Allow: "GET, HEAD", "Cache-Control": "no-store" }).end();
        return true;
    }
    const name = path.slice(assetPrefix.length);
    const matches = assetPath.exec(name);
    const type = matches ? assetTypes.get(matches[1]) : undefined;
    const file = type ? await readBuiltFile(buildDirectory, name) : undefined;
    if (!type || !file) {
        response.writeHead(404, { ...commonHeaders, "Cache-Control": "no-store" }).end();
        return true;
    }
    response.writeHead(200, { ...commonHeaders, "Content-Type": type, "Content-Length": file.length,
        "Cache-Control": "public, max-age=31536000, immutable", "Content-Security-Policy": "default-src 'none'; sandbox" });
    response.end(request.method === "HEAD" ? undefined : file);
    return true;
}
