import { PhpCgiWorker } from "https://cdn.jsdelivr.net/npm/php-cgi-wasm@0.1.0/PhpCgiWorker.mjs";
import { unzipSync } from "https://cdn.jsdelivr.net/npm/fflate@0.8.3/esm/browser.js";

import dom from "https://cdn.jsdelivr.net/npm/php-wasm-dom@0.1.0/index.mjs";
import libxml from "https://cdn.jsdelivr.net/npm/php-wasm-libxml@0.1.0/index.mjs";
import mbstring from "https://cdn.jsdelivr.net/npm/php-wasm-mbstring@0.1.0/index.mjs";
import openssl from "https://cdn.jsdelivr.net/npm/php-wasm-openssl@0.1.0/index.mjs";
import sqlite from "https://cdn.jsdelivr.net/npm/php-wasm-sqlite@0.1.0/index.mjs";
import intl from "https://cdn.jsdelivr.net/npm/php-wasm-intl@0.1.0/index.mjs";
import xml from "https://cdn.jsdelivr.net/npm/php-wasm-xml@0.1.0/index.mjs";
import simplexml from "https://cdn.jsdelivr.net/npm/php-wasm-simplexml@0.1.0/index.mjs";


let bootstrapError = null;
let phpPromise = null;

const runtimeManifestUrl = "/runtime/filesystem/manifest.json";
const runtimeVersionMarkerPath = "/config/runtime-version.txt";
const serviceWorkerScriptPath = "/service-worker.mjs";
const runtimeZipFileName = "www.zip";
const defaultWorkerConfig = {
    prewarmOnActivate: true,
    debugRequestLog: false,
    excludedRequestPathPrefixes: ["/runtime/"],
    excludedRequestPaths: [serviceWorkerScriptPath],
    wasmAssetCachePrefix: "php-wasm-assets",
};
let runtimeWorkerConfig = { ...defaultWorkerConfig };
let wasmAssetCacheName = `${defaultWorkerConfig.wasmAssetCachePrefix}-bootstrap`;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();
const sharedLibs = [
    libxml,
    dom,
    mbstring,
    openssl,
    sqlite,
    intl,
    xml,
    simplexml,
];
const staticTypes = {
    js: "text/javascript",
    mjs: "text/javascript",
    css: "text/css",
    json: "application/json",
    map: "application/json",
    html: "text/html",
    txt: "text/plain",
    svg: "image/svg+xml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    ico: "image/x-icon",
    wasm: "application/wasm",
};


function withSameOriginCredentials(input, init = {}) {

    const requestUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(requestUrl, self.location.origin);

    if (url.origin === self.location.origin && init.credentials === undefined) {
        return {
            ...init,
            credentials: "include",
        };
    }

    return init;
}


function toRequest(input, init) {

    const requestInit = withSameOriginCredentials(input, init);

    return input instanceof Request
        ? new Request(input, requestInit)
        : new Request(input, requestInit);
}


async function broadcastBootstrapProgress(payload) {

    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });

    for (const client of clients) {
        client.postMessage({ type: "wasm-bootstrap-progress", ...payload });
    }
}


function isCacheableWasmAsset(url) {

    if (url.origin === "https://cdn.jsdelivr.net") {
        return url.pathname.includes("/npm/php-")
            || url.pathname.includes("/npm/fflate@");
    }

    return false;
}


async function fetchWithWasmAssetCache(input, init) {

    const request = toRequest(input, init);

    if (request.method !== "GET" || request.cache === "no-store") {
        return fetch(request);
    }

    const url = new URL(request.url);

    if (!isCacheableWasmAsset(url)) {
        return fetch(request);
    }

    const cache = await caches.open(wasmAssetCacheName);
    const cached = await cache.match(request);

    if (cached) {
        return cached;
    }

    const response = await fetch(request);

    if (response.ok) {
        await cache.put(request, response.clone());
    }

    return response;
}


async function pruneWasmAssetCaches() {

    const prefix = `${runtimeWorkerConfig.wasmAssetCachePrefix}-`;
    const cacheKeys = await caches.keys();

    await Promise.all(
        cacheKeys
            .filter(name => name.startsWith(prefix) && name !== wasmAssetCacheName)
            .map(name => caches.delete(name))
    );
}


async function readRuntimeManifest() {

    const response = await fetchWithWasmAssetCache(runtimeManifestUrl, { cache: "no-store" });

    if (!response.ok) {
        throw new Error(`Cannot load runtime manifest: ${response.status}`);
    }

    return response.json();
}


async function readRuntimeZipBuffer(packageFile) {

    const response = await fetchWithWasmAssetCache(`/runtime/filesystem/${packageFile}`, { cache: "no-store" });

    if (!response.ok) {
        throw new Error(`Cannot load runtime ZIP (${packageFile}): ${response.status}`);
    }

    return new Uint8Array(await response.arrayBuffer());
}


function normalizeZipEntryPath(entryName) {

    return entryName
        .replaceAll("\\", "/")
        .replace(/^\.\/+/, "")
        .replace(/^\/+/, "");
}


async function readTextFile(php, filePath) {

    const result = await php.readFile(filePath);

    if (typeof result === "string") {
        return result;
    }

    if (result instanceof Uint8Array) {
        return textDecoder.decode(result);
    }

    return String(result);
}


function createRuntimeLayout(manifest) {

    const installRoot = manifest.installRoot ?? "/persist";
    const appRoot = manifest.appRoot ?? `${installRoot}/www`;
    const docroot = manifest.docroot ?? `${appRoot}/public`;

    return {
        installRoot,
        appRoot,
        docroot,
        indexPath: `${docroot}/index.php`,
        cacheDir: `${appRoot}/var/cache`,
        logDir: `${appRoot}/var/log`,
    };
}


function applyManifestRuntimeConfig(manifest) {

    const workerConfig = manifest.worker ?? {};

    runtimeWorkerConfig = {
        ...defaultWorkerConfig,
        ...workerConfig,
    };

    const versionTag = manifest.versionTag ?? "bootstrap";
    wasmAssetCacheName = `${runtimeWorkerConfig.wasmAssetCachePrefix}-${versionTag}`;
}


async function ensureDirectoryPath(php, targetPath) {

    if (!targetPath || targetPath === "/") {
        return;
    }

    const segments = targetPath.split("/").filter(Boolean);
    let current = "";

    for (const segment of segments) {
        current += `/${segment}`;

        const about = await php.analyzePath(current);

        if (!about.exists) {
            await php.mkdir(current);
        }
    }
}


async function removePathRecursive(php, targetPath) {

    const about = await php.analyzePath(targetPath);

    if (!about.exists) {
        return;
    }

    if (!about.object?.isFolder) {
        await php.unlink(targetPath);
        return;
    }

    const entries = await php.readdir(targetPath);

    for (const entry of entries) {

        if (entry === "." || entry === "..") {
            continue;
        }

        const childPath = `${targetPath}/${entry}`;
        await removePathRecursive(php, childPath);
    }

    await php.rmdir(targetPath);
}


async function installRuntimeFromZip(php, manifest) {

    const runtimeLayout = createRuntimeLayout(manifest);

    await broadcastBootstrapProgress({ stage: "download", progress: 0, message: "Downloading runtime..." });

    const zipContents = await readRuntimeZipBuffer(manifest.packageFile);

    await broadcastBootstrapProgress({ stage: "extract", progress: 5, message: "Extracting runtime..." });

    const unzippedEntries = unzipSync(zipContents);
    const filePaths = Object.keys(unzippedEntries)
        .map(normalizeZipEntryPath)
        .filter(filePath => filePath && !filePath.endsWith("/"))
        .sort((left, right) => left.length - right.length);

    await ensureDirectoryPath(php, runtimeLayout.installRoot);

    await removePathRecursive(php, runtimeLayout.appRoot);

    await broadcastBootstrapProgress({
        stage: "write",
        progress: 10,
        message: `Installing files (0/${filePaths.length})...`,
        completedFiles: 0,
        totalFiles: filePaths.length,
    });

    for (let i = 0; i < filePaths.length; i += 1) {

        const entryPath = filePaths[i];

        const bytes = unzippedEntries[entryPath];
        const targetPath = `${runtimeLayout.installRoot}/${entryPath}`;
        const parent = targetPath.slice(0, targetPath.lastIndexOf("/")) || "/";

        await ensureDirectoryPath(php, parent);
        await php.writeFile(targetPath, bytes);

        const completed = i + 1;
        const shouldReport = completed === filePaths.length || completed % 50 === 0;

        if (shouldReport) {
            const ratio = filePaths.length === 0 ? 1 : completed / filePaths.length;
            const progress = 10 + Math.round(ratio * 85);

            await broadcastBootstrapProgress({
                stage: "write",
                progress,
                message: `Installing files (${completed}/${filePaths.length})...`,
                completedFiles: completed,
                totalFiles: filePaths.length,
            });
        }
    }

    await ensureDirectoryPath(php, runtimeLayout.cacheDir);
    await ensureDirectoryPath(php, runtimeLayout.logDir);

    await ensureDirectoryPath(php, "/config");
    await php.writeFile(
        runtimeVersionMarkerPath,
        textEncoder.encode(`${manifest.versionTag}\n`)
    );

    await broadcastBootstrapProgress({ stage: "ready", progress: 100, message: "Runtime ready" });
}


async function ensureRuntimeInstalled(php, manifest) {

    const runtimeLayout = createRuntimeLayout(manifest);
    const markerPath = await php.analyzePath(runtimeVersionMarkerPath);
    const indexPath = await php.analyzePath(runtimeLayout.indexPath);

    let installedVersion = "";

    if (markerPath.exists) {
        installedVersion = (await readTextFile(php, runtimeVersionMarkerPath)).trim();
    }

    if (installedVersion === manifest.versionTag && indexPath.exists) {
        await broadcastBootstrapProgress({ stage: "ready", progress: 100, message: "Runtime already installed" });
        return;
    }

    await installRuntimeFromZip(php, manifest);
}


function createPhpWorker(manifest) {

    const runtimeLayout = createRuntimeLayout(manifest);

    return new PhpCgiWorker({

        version: "8.1",
        onRequest,
        notFound: createNotFoundResponse,

        prefix: "/",

        // Runtime is installed from /runtime/filesystem/www.zip into /persist/www.
        docroot: runtimeLayout.docroot,


        rewrite: pathname => {

            if (pathname === "/" || pathname.endsWith("/")) {
                return {
                    scriptName: "/index.php",
                    path: "/index.php"
                };
            }

            if (pathname.endsWith(".php") || pathname.includes(".")) {
                return pathname;
            }

            return {
                scriptName: "/index.php",
                path: "/index.php"
            };
        },


        exclude: [
            ...runtimeWorkerConfig.excludedRequestPathPrefixes,
            ...runtimeWorkerConfig.excludedRequestPaths,
        ],

        types: staticTypes,


        sharedLibs,

        persist: [
            { mountPath: "/persist" },
            { mountPath: "/config" },
        ],


    });
}


function createBootstrapErrorResponse(error) {

    return new Response(
        [
            "PHP WASM bootstrap error",
            "",
            error.stack
                ? error.stack
                : String(error)
        ].join("\n"),
        {
            status: 500,
            headers: {
                "Content-Type": "text/plain; charset=utf-8"
            }
        }
    );
}


function onRequest(request, response) {

    if (!runtimeWorkerConfig.debugRequestLog) {
        return;
    }

    const url = new URL(request.url);
    const logLine = `[${new Date().toISOString()}] 127.0.0.1 - "${request.method} ${url.pathname}" - HTTP/1.1 ${response.status}`;
    console.log(logLine);
}


function createNotFoundResponse(request) {

    return new Response(
        `<body><h1>404</h1>${request.url} not found</body>`,
        {
            status: 404,
            headers: {
                "Content-Type": "text/html; charset=utf-8"
            }
        }
    );
}


// cgi-worker style lazy singleton bootstrap.
async function init() {

    if (phpPromise) {
        return phpPromise;
    }

    phpPromise = (async () => {

        await broadcastBootstrapProgress({ stage: "boot", progress: 0, message: "Initializing PHP WASM..." });

        const manifest = await readRuntimeManifest();
        applyManifestRuntimeConfig(manifest);
        await pruneWasmAssetCaches();

        const worker = createPhpWorker(manifest);

        await worker.binary;

        await broadcastBootstrapProgress({ stage: "boot", progress: 2, message: "PHP WASM loaded" });

        await ensureRuntimeInstalled(worker, manifest);

        return worker;
    })();

    phpPromise.catch(error => {
        bootstrapError = error;
        console.error("PHP WASM bootstrap failed", error);
    });

    return phpPromise;
}


function ensureBootstrapStarted() {

    if (bootstrapError) {
        return Promise.reject(bootstrapError);
    }

    return init();
}



function shouldBypass(url) {

    if (url.origin !== self.location.origin) {
        return true;
    }

    return runtimeWorkerConfig.excludedRequestPathPrefixes.some(prefix => url.pathname.startsWith(prefix))
        || runtimeWorkerConfig.excludedRequestPaths.includes(url.pathname);

}


self.addEventListener(
    "install",
    event => event.waitUntil(self.skipWaiting())
);



self.addEventListener(
    "activate",
    event => event.waitUntil((async () => {
        await self.clients.claim();

        if (!runtimeWorkerConfig.prewarmOnActivate) {
            return;
        }

        ensureBootstrapStarted().catch(error => {
            // Keep activation successful even if warmup fails.
            console.error("PHP WASM prewarm failed", error);
        });
    })())
);


self.addEventListener(
    "message",
    event => event.waitUntil(
        ensureBootstrapStarted().then(php => php.handleMessageEvent(event))
    )
);



self.addEventListener(
    "fetch",
    event => {
        const url = new URL(event.request.url);


        if (shouldBypass(url)) {
            return;
        }

        event.respondWith((async () => {

            if (bootstrapError) {
                return createBootstrapErrorResponse(bootstrapError);
            }

            try {
                const php = await ensureBootstrapStarted();
                const response = await php.request(event.request);

                if (response instanceof Response) {
                    return response;
                }

                return createNotFoundResponse(event.request);
            } catch (error) {
                bootstrapError = error;
                return createBootstrapErrorResponse(error);
            }

        })());

    }
);