#!/usr/bin/env node

import { createReadStream, existsSync, statSync } from "node:fs";
import { promises as fs } from "node:fs";
import http, { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import { normalizeText } from "./utils";
import { handlePreviewStateApi, PREVIEW_STATE_API_PREFIX } from "./api/previewState";
import { handleBacklogApi, BACKLOG_API_PREFIX } from "./api/backlog";
import { sendNotFound } from "./api/httpUtils";
import { renderHomeHtml } from "./html/previewPages";
import type { AppReports } from "./html/previewPages";
import type { ApiRouteContext } from "./api/types";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  file?: string;
  dataDir?: string;
  host: string;
  port: number;
}

const REPORT_FILE_EXTENSIONS = new Set([".html", ".md", ".json"]);
const REPORT_EXT_ORDER: Record<string, number> = {
  ".json": 0,
  ".md": 1,
  ".html": 2
};

const DEFAULT_REPORT_BUNDLE_FILE_NAME = "competitor-raw-actionable.ko.json";
const DEFAULT_REPORT_HTML_FILE_NAME = "competitor-raw-actionable.ko.html";
const APP_ICON_ROUTE_PREFIX = "/assets/app-icons/";

function toAbsolutePath(input: string): string {
  return path.resolve(process.cwd(), input);
}

function extPriority(fileName: string): number {
  const ext = path.extname(fileName).toLowerCase();
  return REPORT_EXT_ORDER[ext] ?? 9;
}

function isReportFile(fileName: string): boolean {
  return REPORT_FILE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

async function parseArgs(): Promise<CliArgs> {
  const parsed = await yargs(hideBin(process.argv))
    .scriptName("report:preview")
    .usage("$0 [options]")
    .option("my-app", {
      type: "string",
      describe: "Owner app key used to filter app list on the home dashboard"
    })
    .option("registered-apps-path", {
      type: "string",
      describe: "Path to registered-apps.json (default: ~/.config/pabal-mcp/registered-apps.json)"
    })
    .option("file", {
      type: "string",
      describe: "Single-file mode: serve this html file at /"
    })
    .option("data-dir", {
      type: "string",
      describe: "Data root for dashboard mode (default: data/)"
    })
    .option("host", {
      type: "string",
      default: "127.0.0.1",
      describe: "Host to bind"
    })
    .option("port", {
      type: "number",
      default: 4173,
      describe: "Port to bind"
    })
    .help()
    .strict()
    .parse();

  return parsed as unknown as CliArgs;
}

function contentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") {
    return "text/html; charset=utf-8";
  }
  if (ext === ".md") {
    return "text/markdown; charset=utf-8";
  }
  if (ext === ".css") {
    return "text/css; charset=utf-8";
  }
  if (ext === ".js") {
    return "application/javascript; charset=utf-8";
  }
  if (ext === ".json") {
    return "application/json; charset=utf-8";
  }
  if (ext === ".png") {
    return "image/png";
  }
  if (ext === ".jpg" || ext === ".jpeg") {
    return "image/jpeg";
  }
  if (ext === ".svg") {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}

function safeJoin(baseDir: string, relativeUrlPath: string): string | undefined {
  const decoded = decodeURIComponent(relativeUrlPath.split("?")[0]);
  const normalized = path.normalize(decoded).replace(/^([/\\])+/, "");
  const resolved = path.resolve(baseDir, normalized);

  if (!resolved.startsWith(baseDir)) {
    return undefined;
  }

  return resolved;
}

function sendHtml(res: ServerResponse, html: string): void {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(html);
}

function serveFile(res: ServerResponse, filePath: string): void {
  try {
    const stat = statSync(filePath);
    if (!stat.isFile()) {
      sendNotFound(res);
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", contentType(filePath));
    createReadStream(filePath).pipe(res);
  } catch {
    sendNotFound(res);
  }
}

function isSafeAppId(appId: string): boolean {
  return /^[a-z0-9._-]+$/i.test(appId);
}

function resolveDashboardIconPath(dataRoot: string, appId: string): string | undefined {
  const inAppIcon = path.resolve(dataRoot, appId, "icon.png");
  if (existsSync(inAppIcon)) {
    return inAppIcon;
  }
  return undefined;
}

async function resolveViewerHtmlFromBundle(dataRoot: string, appId: string): Promise<string | undefined> {
  const bundlePath = path.resolve(dataRoot, appId, "reports", DEFAULT_REPORT_BUNDLE_FILE_NAME);
  try {
    const raw = await fs.readFile(bundlePath, "utf8");
    const payload = JSON.parse(raw) as unknown;
    if (!payload || typeof payload !== "object") {
      return undefined;
    }
    const row = payload as Record<string, unknown>;
    const html = typeof row.html === "string" ? row.html : "";
    if (!html.trim()) {
      return undefined;
    }
    return html;
  } catch {
    return undefined;
  }
}

function handleAppIconRequest(pathname: string, res: ServerResponse, dataRoot: string, filterAppId?: string): boolean {
  if (!pathname.startsWith(APP_ICON_ROUTE_PREFIX)) {
    return false;
  }

  const tail = pathname.slice(APP_ICON_ROUTE_PREFIX.length);
  if (!tail.endsWith(".png")) {
    sendNotFound(res);
    return true;
  }

  const encodedAppId = tail.slice(0, -4);
  if (!encodedAppId || encodedAppId.includes("/")) {
    sendNotFound(res);
    return true;
  }

  let decodedAppId = encodedAppId;
  try {
    decodedAppId = decodeURIComponent(encodedAppId);
  } catch {
    sendNotFound(res);
    return true;
  }

  const appId = normalizeText(decodedAppId);
  if (!appId || !isSafeAppId(appId)) {
    sendNotFound(res);
    return true;
  }

  if (filterAppId && appId !== filterAppId) {
    sendNotFound(res);
    return true;
  }

  const iconTarget = resolveDashboardIconPath(dataRoot, appId);
  if (!iconTarget) {
    sendNotFound(res);
    return true;
  }

  serveFile(res, iconTarget);
  return true;
}

async function loadAppReports(dataRoot: string, filterAppId?: string): Promise<AppReports[]> {
  const entries = await fs.readdir(dataRoot, { withFileTypes: true }).catch(() => []);
  const filtered = entries.filter((entry) => entry.isDirectory());

  const appReports: AppReports[] = [];
  for (const entry of filtered) {
    const appId = entry.name;
    if (filterAppId && appId !== filterAppId) {
      continue;
    }

    const reportsDir = path.resolve(dataRoot, appId, "reports");
    const reportEntries = await fs.readdir(reportsDir, { withFileTypes: true }).catch(() => []);
    const files = reportEntries
      .filter((fileEntry) => fileEntry.isFile())
      .map((fileEntry) => fileEntry.name)
      .filter(isReportFile)
      .sort((a, b) => {
        const priority = extPriority(a) - extPriority(b);
        if (priority !== 0) {
          return priority;
        }
        return a.localeCompare(b);
      });

    if (!files.length) {
      continue;
    }

    const iconPath = resolveDashboardIconPath(dataRoot, appId);
    appReports.push({
      appId,
      iconHref: iconPath ? `${APP_ICON_ROUTE_PREFIX}${encodeURIComponent(appId)}.png` : undefined,
      reports: files.map((fileName) => ({
        fileName,
        href: `/r/${encodeURIComponent(appId)}/${encodeURIComponent(fileName)}`
      }))
    });
  }

  return appReports.sort((a, b) => a.appId.localeCompare(b.appId));
}

function createSingleFileHandler(baseDir: string, indexPath: string, context: ApiRouteContext) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rawUrl = normalizeText(req.url) || "/";
    const pathname = rawUrl.split("?")[0];

    if (await handlePreviewStateApi(req, res, pathname, context)) {
      return;
    }
    if (await handleBacklogApi(req, res, pathname, context)) {
      return;
    }

    if (handleAppIconRequest(pathname, res, context.dataRoot, context.filterAppId)) {
      return;
    }

    if (pathname === "/") {
      serveFile(res, indexPath);
      return;
    }

    const target = safeJoin(baseDir, pathname);
    if (!target) {
      sendNotFound(res);
      return;
    }

    serveFile(res, target);
  };
}

function createDashboardHandler(context: ApiRouteContext) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rawUrl = normalizeText(req.url) || "/";
    const pathname = rawUrl.split("?")[0];

    if (await handlePreviewStateApi(req, res, pathname, context)) {
      return;
    }
    if (await handleBacklogApi(req, res, pathname, context)) {
      return;
    }

    if (pathname === "/") {
      const apps = await loadAppReports(context.dataRoot, context.filterAppId);
      sendHtml(res, renderHomeHtml(apps, context.filterAppId));
      return;
    }

    if (handleAppIconRequest(pathname, res, context.dataRoot, context.filterAppId)) {
      return;
    }

    if (pathname.startsWith("/v/")) {
      const appId = normalizeText(decodeURIComponent(pathname.slice(3)));
      if (!appId || !isSafeAppId(appId)) {
        sendNotFound(res);
        return;
      }
      if (context.filterAppId && appId !== context.filterAppId) {
        sendNotFound(res);
        return;
      }

      const viewerHtml = await resolveViewerHtmlFromBundle(context.dataRoot, appId);
      if (viewerHtml) {
        sendHtml(res, viewerHtml);
        return;
      }

      const legacyHtmlPath = path.resolve(context.dataRoot, appId, "reports", DEFAULT_REPORT_HTML_FILE_NAME);
      if (existsSync(legacyHtmlPath)) {
        serveFile(res, legacyHtmlPath);
        return;
      }

      sendNotFound(res);
      return;
    }

    if (!pathname.startsWith("/r/")) {
      sendNotFound(res);
      return;
    }

    const parts = pathname
      .slice(3)
      .split("/")
      .filter((item) => item.length > 0)
      .map((item) => decodeURIComponent(item));

    if (parts.length < 2) {
      sendNotFound(res);
      return;
    }

    const [appId, ...rest] = parts;
    if (!isSafeAppId(appId)) {
      sendNotFound(res);
      return;
    }

    if (context.filterAppId && appId !== context.filterAppId) {
      sendNotFound(res);
      return;
    }

    const reportBase = path.resolve(context.dataRoot, appId, "reports");
    const relativeReportPath = rest.join("/");
    const target = safeJoin(reportBase, relativeReportPath);

    if (!target) {
      sendNotFound(res);
      return;
    }

    serveFile(res, target);
  };
}

async function ensureReportExists(filePath: string): Promise<void> {
  if (existsSync(filePath)) {
    return;
  }

  const dir = path.dirname(filePath);
  const siblings = await fs.readdir(dir).catch(() => [] as string[]);
  const hasMd = siblings.includes("competitor-raw-actionable.ko.md");

  if (hasMd) {
    throw new Error(`Report HTML not found: ${filePath}\nRun: npm run report:render-html -- --my-app <owner>`);
  }

  throw new Error(`Report HTML not found: ${filePath}`);
}

async function main(): Promise<void> {
  const argv = await parseArgs();

  let ownerAppId: string | undefined;
  if (normalizeText(argv.myApp)) {
    const owner = await resolveOwnerApp(String(argv.myApp), argv.registeredAppsPath);
    ownerAppId = owner.ownerAppId;
  }

  const singleFilePath = normalizeText(argv.file) ? toAbsolutePath(String(argv.file)) : undefined;
  const dataRoot = normalizeText(argv.dataDir)
    ? path.resolve(process.cwd(), String(argv.dataDir))
    : path.resolve(process.cwd(), "data");

  const context: ApiRouteContext = {
    dataRoot,
    filterAppId: ownerAppId
  };

  let server: http.Server;

  if (singleFilePath) {
    await ensureReportExists(singleFilePath);
    const baseDir = path.dirname(singleFilePath);
    server = http.createServer(createSingleFileHandler(baseDir, singleFilePath, context));
  } else {
    server = http.createServer(createDashboardHandler(context));
  }

  server.listen(argv.port, argv.host, () => {
    console.log(`Preview server running`);
    if (ownerAppId) {
      console.log(`- ownerAppId filter: ${ownerAppId}`);
    }
    if (singleFilePath) {
      console.log(`- mode: single-file`);
      console.log(`- file: ${singleFilePath}`);
    } else {
      console.log(`- mode: dashboard`);
      console.log(
        `- route: / (apps list), /v/:app (shared viewer), /r/:app/:file (report file), ${PREVIEW_STATE_API_PREFIX}:appId, ${BACKLOG_API_PREFIX}:appId`
      );
    }
    console.log(`- url: http://${argv.host}:${argv.port}/`);
    console.log(`Press Ctrl+C to stop.`);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
