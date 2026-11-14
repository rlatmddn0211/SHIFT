import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { servePhoneAsset, writePhonePage } from "./mobile-web.ts";

test("phone web shell uses same-origin CSP and exposes only hashed build assets", async t => {
    const dist = await mkdtemp(join(tmpdir(), "shift-phone-test-"));
    t.after(() => rm(dist, { recursive: true, force: true }));
    const buildDirectory = pathToFileURL(`${dist}${sep}`);
    const html = '<html lang="ko"><script type="module" src="/shift-phone-assets/assets/index-AbC123-_x.js"></script></html>';
    const script = "window.ok = true;";
    await mkdir(join(dist, "assets"));
    await writeFile(join(dist, "assets", "index-AbC123-_x.js"), script);
    const model = { kind: "notes" as const, title: "내 방문 메모", notes: [] };
    const server = createServer(async (request, response) => {
        if (await servePhoneAsset(request, response, buildDirectory)) return;
        if (await writePhonePage(request, response, 401, model, buildDirectory)) return;
        response.writeHead(401).end("previous HTML page");
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
    const { port } = server.address() as AddressInfo;
    const get = (path: string, init?: RequestInit) => fetch(`http://127.0.0.1:${port}${path}`, init);

    const htmlRequest = { headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" } };
    assert.equal(await (await get("/mobile/notes", htmlRequest)).text(), "previous HTML page");
    await writeFile(join(dist, "index.html"), html);
    const shell = await get("/mobile/notes", htmlRequest);
    assert.equal(shell.status, 401);
    assert.equal(shell.headers.get("cache-control"), "no-store");
    assert.equal(shell.headers.get("referrer-policy"), "no-referrer");
    assert.equal(shell.headers.get("vary"), "Accept");
    const policy = shell.headers.get("content-security-policy")!;
    assert.match(policy, /default-src 'none'/);
    assert.match(policy, /script-src 'self'/);
    assert.match(policy, /connect-src 'self'/);
    assert.match(policy, /frame-ancestors 'none'/);
    assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/);
    assert.equal(await shell.text(), html);
    const json = await get("/mobile/notes", { headers: { Accept: "application/json" } });
    assert.match(json.headers.get("content-type")!, /application\/json/);
    assert.deepEqual(await json.json(), model);
    assert.equal(await (await get("/mobile/notes")).text(), "previous HTML page");
    assert.equal(await (await get("/mobile/notes", { method: "POST", headers: { Accept: "text/html,application/json;q=0" } })).text(), "previous HTML page");

    const assetPath = "/shift-phone-assets/assets/index-AbC123-_x.js";
    const asset = await get(assetPath);
    assert.match(asset.headers.get("content-type")!, /javascript/);
    assert.match(asset.headers.get("cache-control")!, /immutable/);
    assert.equal(await asset.text(), script);
    const head = await get(assetPath, { method: "HEAD" });
    assert.equal(head.headers.get("content-length"), String(script.length));
    assert.equal(await head.text(), "");
    assert.equal((await get(assetPath, { method: "POST" })).status, 405);
    for (const path of ["/shift-phone-assets/index.html", "/shift-phone-assets/assets/%2E%2E%2Findex.html", "/shift-phone-assets/assets/index.js"]) {
        assert.equal((await get(path)).status, 404);
    }
});
