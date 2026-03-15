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
  host: string;
  port: number;
}

function defaultHtmlPath(ownerAppId: string): string {
  return path.resolve(process.cwd(), "data", ownerAppId, "reports", "competitor-raw-actionable.ko.html");
}

function toAbsolutePath(input: string | undefined, ownerAppId: string): string {
  if (normalizeText(input)) {
    return path.resolve(process.cwd(), String(input));
  }

  return defaultHtmlPath(ownerAppId);
}

async function parseArgs(): Promise<CliArgs> {
  const parsed = await yargs(hideBin(process.argv))
    .scriptName("preview-report")
    .usage("$0 --my-app <owner> [options]")
    .option("my-app", {
      type: "string",
      demandOption: true,
      describe: "Owner app key used to resolve app slug"
    })
    .option("registered-apps-path", {
      type: "string",
      describe: "Path to registered-apps.json (default: ~/.config/pabal-mcp/registered-apps.json)"
    })
    .option("file", {
      type: "string",
      describe: "HTML report path (default: data/{myAppId}/reports/competitor-raw-actionable.ko.html)"
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

function requestHandler(baseDir: string, indexPath: string) {
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
        `Run: npm run render-report-html -- --my-app <owner>`
    );
  }

  throw new Error(`Report HTML not found: ${filePath}`);
}

async function main(): Promise<void> {
  const argv = await parseArgs();
  const owner = await resolveOwnerApp(String(argv.myApp), argv.registeredAppsPath);
  const ownerAppId = owner.ownerAppId;

  const htmlPath = toAbsolutePath(argv.file, ownerAppId);
  await ensureReportExists(htmlPath);

  const baseDir = path.dirname(htmlPath);
  const server = http.createServer(requestHandler(baseDir, htmlPath));

  server.listen(argv.port, argv.host, () => {
    console.log(`Preview server running`);
    console.log(`- ownerAppId: ${ownerAppId}`);
    console.log(`- file: ${htmlPath}`);
    console.log(`- url: http://${argv.host}:${argv.port}/`);
    console.log(`Press Ctrl+C to stop.`);
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
