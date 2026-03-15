#!/usr/bin/env node

import { createReadStream, existsSync, statSync } from "node:fs";
import { promises as fs } from "node:fs";
import http, { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import { normalizeText } from "./utils";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  file?: string;
  dataDir?: string;
  host: string;
  port: number;
}

interface ReportEntry {
  fileName: string;
  href: string;
}

interface AppReports {
  appId: string;
  reports: ReportEntry[];
}

const REPORT_FILE_EXTENSIONS = new Set([".html", ".md", ".json"]);
const REPORT_EXT_ORDER: Record<string, number> = {
  ".html": 0,
  ".md": 1,
  ".json": 2
};

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

function sendNotFound(res: ServerResponse): void {
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end("Not Found");
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

    appReports.push({
      appId,
      reports: files.map((fileName) => ({
        fileName,
        href: `/r/${encodeURIComponent(appId)}/${encodeURIComponent(fileName)}`
      }))
    });
  }

  return appReports.sort((a, b) => a.appId.localeCompare(b.appId));
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHomeHtml(apps: AppReports[], filterAppId?: string): string {
  const cards = apps
    .map((app) => {
      const links = app.reports
        .map((report) => {
          const ext = path.extname(report.fileName).toLowerCase().replace(".", "").toUpperCase();
          return `<a class=\"file-link\" href=\"${escapeHtml(report.href)}\">${escapeHtml(report.fileName)} <span class=\"tag\">${ext}</span></a>`;
        })
        .join("\n");

      return `
        <section class=\"card searchable\" data-search=\"${escapeHtml(
          `${app.appId} ${app.reports.map((x) => x.fileName).join(" ")}`
        ).toLowerCase()}\">
          <h2>${escapeHtml(app.appId)}</h2>
          <div class=\"links\">${links}</div>
        </section>
      `;
    })
    .join("\n");

  const infoLine = filterAppId
    ? `Filter: <code>${escapeHtml(filterAppId)}</code>`
    : "All App Reports";

  const emptyState = `
    <div class=\"empty\">
      <p>No reports found.</p>
      <p>Generate a report first with:</p>
      <pre>npm run report:render-html -- --my-app &lt;owner&gt;</pre>
    </div>
  `;

  return `<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Report Preview Dashboard</title>
    <style>
      :root {
        --bg: #f3f7fb;
        --panel: #ffffff;
        --ink: #0f172a;
        --sub: #475569;
        --line: #dbe6f0;
        --accent: #0284c7;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: var(--bg);
      }
      .wrap {
        max-width: 1160px;
        margin: 0 auto;
        padding: 22px 14px 40px;
      }
      h1 {
        margin: 0 0 6px;
        font-size: 1.5rem;
      }
      .sub {
        margin: 0 0 14px;
        color: var(--sub);
        font-size: 13px;
      }
      .toolbar {
        margin-bottom: 14px;
      }
      .toolbar input {
        width: min(520px, 100%);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 10px 12px;
        font-size: 14px;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 12px;
      }
      .card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel);
        padding: 12px;
      }
      .card h2 {
        margin: 0 0 10px;
        font-size: 1rem;
      }
      .links {
        display: grid;
        gap: 8px;
      }
      .file-link {
        text-decoration: none;
        color: var(--ink);
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 8px 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .file-link:hover {
        border-color: var(--accent);
        color: var(--accent);
      }
      .tag {
        font-size: 11px;
        color: var(--sub);
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 2px 7px;
      }
      .empty {
        border: 1px dashed var(--line);
        border-radius: 12px;
        background: var(--panel);
        padding: 16px;
        color: var(--sub);
      }
      .hidden { display: none; }
    </style>
  </head>
  <body>
    <main class=\"wrap\">
      <h1>Report Preview Dashboard</h1>
      <p class=\"sub\">${infoLine} · Click a file to open it from local storage.</p>
      <div class=\"toolbar\">
        <input id=\"search\" type=\"search\" placeholder=\"Search by app ID or file name\" />
      </div>
      ${apps.length ? `<section class=\"grid\" id=\"grid\">${cards}</section>` : emptyState}
    </main>
    <script>
      const input = document.getElementById('search');
      const cards = Array.from(document.querySelectorAll('.searchable'));
      if (input) {
        input.addEventListener('input', () => {
          const q = input.value.trim().toLowerCase();
          cards.forEach((card) => {
            const text = (card.getAttribute('data-search') || '').toLowerCase();
            const visible = !q || text.includes(q);
            card.classList.toggle('hidden', !visible);
          });
        });
      }
    </script>
  </body>
</html>`;
}

function createSingleFileHandler(baseDir: string, indexPath: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const urlPath = normalizeText(req.url) || "/";

    if (urlPath === "/") {
      serveFile(res, indexPath);
      return;
    }

    const target = safeJoin(baseDir, urlPath);
    if (!target) {
      sendNotFound(res);
      return;
    }

    serveFile(res, target);
  };
}

function createDashboardHandler(dataRoot: string, filterAppId?: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rawUrl = normalizeText(req.url) || "/";
    const pathname = rawUrl.split("?")[0];

    if (pathname === "/") {
      const apps = await loadAppReports(dataRoot, filterAppId);
      sendHtml(res, renderHomeHtml(apps, filterAppId));
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

    if (filterAppId && appId !== filterAppId) {
      sendNotFound(res);
      return;
    }

    const reportBase = path.resolve(dataRoot, appId, "reports");
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
    throw new Error(
      `Report HTML not found: ${filePath}\n` +
        `Run: npm run report:render-html -- --my-app <owner>`
    );
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

  let server: http.Server;

  if (singleFilePath) {
    await ensureReportExists(singleFilePath);
    const baseDir = path.dirname(singleFilePath);
    server = http.createServer(createSingleFileHandler(baseDir, singleFilePath));
  } else {
    const dataRoot = normalizeText(argv.dataDir)
      ? path.resolve(process.cwd(), String(argv.dataDir))
      : path.resolve(process.cwd(), "data");

    server = http.createServer(createDashboardHandler(dataRoot, ownerAppId));
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
      console.log(`- route: / (apps list), /r/:app/:file (report file)`);
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
