#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import { normalizeText } from "./utils";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  dataDir?: string;
  input?: string;
  all: boolean;
  force: boolean;
  dryRun: boolean;
}

interface InitBacklogResult {
  ownerAppId: string;
  backlogPath: string;
  status: "generated" | "kept";
}

const execFileAsync = promisify(execFile);
const REPORTS_DIR_NAME = "reports";
const BACKLOG_FILE_NAME = "backlog.ko.json";
const DEFAULT_REPORT_BUNDLE_FILE_NAME = "competitor-raw-actionable.ko.json";

function resolveDataRoot(input?: string): string {
  return input ? path.resolve(process.cwd(), input) : path.resolve(process.cwd(), "data");
}

function resolveBacklogPath(dataRoot: string, ownerAppId: string): string {
  return path.resolve(dataRoot, ownerAppId, REPORTS_DIR_NAME, BACKLOG_FILE_NAME);
}

function resolveDefaultBundlePath(dataRoot: string, ownerAppId: string): string {
  return path.resolve(dataRoot, ownerAppId, REPORTS_DIR_NAME, DEFAULT_REPORT_BUNDLE_FILE_NAME);
}

async function pathExists(targetPath: string): Promise<boolean> {
  return await fs
    .access(targetPath)
    .then(() => true)
    .catch(() => false);
}

async function hasJsonFileInDir(dirPath: string): Promise<boolean> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  return entries.some((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".json"));
}

async function canRenderBacklog(dataRoot: string, ownerAppId: string): Promise<boolean> {
  const hasBundle = await pathExists(resolveDefaultBundlePath(dataRoot, ownerAppId));
  if (hasBundle) {
    return true;
  }

  const reviewsDir = path.resolve(dataRoot, ownerAppId, "reviews");
  if (await hasJsonFileInDir(reviewsDir)) {
    return true;
  }

  const translatedReviewsDir = path.resolve(dataRoot, ownerAppId, "reviews-ko");
  return await hasJsonFileInDir(translatedReviewsDir);
}

async function listAllTargetApps(dataRoot: string): Promise<string[]> {
  const entries = await fs.readdir(dataRoot, { withFileTypes: true }).catch(() => []);
  const apps: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const ownerAppId = entry.name;
    if (await canRenderBacklog(dataRoot, ownerAppId)) {
      apps.push(ownerAppId);
    }
  }

  return apps.sort((a, b) => a.localeCompare(b));
}

async function parseArgs(): Promise<CliArgs> {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("report:init-backlog")
    .usage("$0 --my-app <owner> [options]")
    .option("my-app", {
      type: "string",
      describe: "Owner app id/slug/name/bundleId/packageName (required unless --all)"
    })
    .option("all", {
      type: "boolean",
      default: false,
      describe: "Initialize backlog for all apps under data/"
    })
    .option("registered-apps-path", {
      type: "string",
      describe: "Path to registered-apps.json (default: ~/.config/pabal-mcp/registered-apps.json)"
    })
    .option("data-dir", {
      type: "string",
      describe: "Data root (default: data/)"
    })
    .option("input", {
      type: "string",
      describe: "Optional report source (.md/.json) for single-app mode (passed to report:render-html)"
    })
    .option("force", {
      type: "boolean",
      default: false,
      describe: "Regenerate backlog even when backlog.ko.json already exists"
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Print planned actions without writing files"
    })
    .help()
    .strict()
    .parse();

  return argv as unknown as CliArgs;
}

async function runRenderToGenerateBacklog(ownerAppId: string, inputPath?: string): Promise<void> {
  const scriptPath = path.resolve(__dirname, "renderReportHtml.js");
  const args = [scriptPath, "--my-app", ownerAppId];

  if (normalizeText(inputPath)) {
    args.push("--input", path.resolve(process.cwd(), String(inputPath)));
  }

  await execFileAsync(process.execPath, args, {
    cwd: process.cwd(),
    maxBuffer: 20 * 1024 * 1024
  });
}

async function initBacklogForApp(params: {
  ownerAppId: string;
  dataRoot: string;
  force: boolean;
  dryRun: boolean;
  inputPath?: string;
}): Promise<InitBacklogResult> {
  const { ownerAppId, dataRoot, force, dryRun, inputPath } = params;
  const backlogPath = resolveBacklogPath(dataRoot, ownerAppId);
  const exists = await pathExists(backlogPath);

  if (exists && !force) {
    return {
      ownerAppId,
      backlogPath,
      status: "kept"
    };
  }

  if (!dryRun) {
    if (exists && force) {
      await fs.rm(backlogPath, { force: true });
    }
    await runRenderToGenerateBacklog(ownerAppId, inputPath);
  }

  const created = dryRun ? true : await pathExists(backlogPath);
  if (!created) {
    throw new Error(`Failed to initialize backlog for ${ownerAppId}: ${backlogPath}`);
  }

  return {
    ownerAppId,
    backlogPath,
    status: "generated"
  };
}

async function runSingle(argv: CliArgs): Promise<InitBacklogResult[]> {
  if (!argv.myApp) {
    throw new Error("--my-app is required unless --all is used");
  }

  const resolved = await resolveOwnerApp(argv.myApp, argv.registeredAppsPath);
  const ownerAppId = resolved.ownerAppId;
  const dataRoot = resolveDataRoot(argv.dataDir);

  const result = await initBacklogForApp({
    ownerAppId,
    dataRoot,
    force: argv.force,
    dryRun: argv.dryRun,
    inputPath: argv.input
  });

  return [result];
}

async function runAll(argv: CliArgs): Promise<InitBacklogResult[]> {
  if (argv.myApp || argv.input) {
    throw new Error("--all cannot be combined with --my-app or --input");
  }

  const dataRoot = resolveDataRoot(argv.dataDir);
  const apps = await listAllTargetApps(dataRoot);
  if (!apps.length) {
    throw new Error(`No backlog init targets found under ${dataRoot}`);
  }

  const results: InitBacklogResult[] = [];
  for (const ownerAppId of apps) {
    const result = await initBacklogForApp({
      ownerAppId,
      dataRoot,
      force: argv.force,
      dryRun: argv.dryRun
    });
    results.push(result);
  }

  return results;
}

function printSummary(results: InitBacklogResult[], dryRun: boolean): void {
  const generated = results.filter((item) => item.status === "generated").length;
  const kept = results.length - generated;
  console.log("[report:init-backlog]");
  console.log(`- dryRun: ${String(dryRun)}`);
  console.log(`- apps: ${results.length}`);
  console.log(`- generated: ${generated}`);
  console.log(`- kept: ${kept}`);

  for (const item of results) {
    console.log(`- ${item.ownerAppId}: ${item.status}`);
    console.log(`  backlog: ${item.backlogPath}`);
  }
}

async function main(): Promise<void> {
  const argv = await parseArgs();
  const results = argv.all ? await runAll(argv) : await runSingle(argv);
  printSummary(results, argv.dryRun);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[report:init-backlog] ERROR: ${message}`);
  process.exitCode = 1;
});
