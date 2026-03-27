#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import { normalizeText } from "./utils";

type ReviewTag = "heart" | "satisfaction" | "dissatisfaction" | "requests";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  dataDir?: string;
  input?: string;
  output?: string;
  all: boolean;
  keepNotes: boolean;
}

interface ReviewStateEntry {
  excluded: boolean;
  tags: ReviewTag[];
  updatedAt: string;
}

interface BacklogNoteEntry {
  content: string;
  updatedAt: string;
}

interface PreviewStateFile {
  version: 3;
  ownerAppId: string;
  updatedAt: string;
  reviews: Record<string, ReviewStateEntry>;
  backlogNotes: Record<string, BacklogNoteEntry>;
}

interface InitResult {
  ownerAppId: string;
  inputPath: string;
  outputPath: string;
  sourceCount: number;
  reviewCount: number;
  activeCount: number;
  inactiveCount: number;
}

interface ReportBundlePayload {
  version?: number;
  ownerAppId?: string;
  reviewDefaults?: Record<string, { excluded?: unknown; tags?: unknown }>;
  html?: string;
}

const PREVIEW_TAG_ORDER: ReviewTag[] = ["heart", "satisfaction", "dissatisfaction", "requests"];
const PREVIEW_TAG_SET = new Set<ReviewTag>(PREVIEW_TAG_ORDER);
const DEFAULT_INPUT_FILE_NAME = "competitor-raw-actionable.ko.json";
const PREVIEW_STATE_FILE_NAME = "preview-state.json";

function resolveDataRoot(input?: string): string {
  return input ? path.resolve(process.cwd(), input) : path.resolve(process.cwd(), "data");
}

function parseTagList(input: string): ReviewTag[] {
  if (!input.trim()) {
    return [];
  }

  const seen = new Set<ReviewTag>();
  const ordered: ReviewTag[] = [];

  for (const raw of input.split(",")) {
    const tag = normalizeText(raw).toLowerCase() as ReviewTag;
    if (!PREVIEW_TAG_SET.has(tag) || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    ordered.push(tag);
  }

  return ordered;
}

function normalizeReviewTags(value: unknown): ReviewTag[] {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set<ReviewTag>();
  const ordered: ReviewTag[] = [];

  for (const raw of source) {
    const tag = normalizeText(String(raw ?? "")).toLowerCase() as ReviewTag;
    if (!PREVIEW_TAG_SET.has(tag) || seen.has(tag)) {
      continue;
    }
    seen.add(tag);
    ordered.push(tag);
  }

  return ordered;
}

function mergeTags(base: ReviewTag[], extra: ReviewTag[]): ReviewTag[] {
  const set = new Set<ReviewTag>(base);
  for (const tag of extra) {
    set.add(tag);
  }
  return PREVIEW_TAG_ORDER.filter((tag) => set.has(tag));
}

function decodeHtmlAttr(input: string): string {
  return input
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getAttr(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`${name}="([^"]*)"`, "i"));
  if (!match) {
    return undefined;
  }
  return decodeHtmlAttr(match[1] ?? "");
}

function extractReviewDefaultsFromHtml(html: string, updatedAt: string): {
  sourceCount: number;
  reviewStates: Record<string, ReviewStateEntry>;
} {
  const reviewStates: Record<string, ReviewStateEntry> = {};
  const cards = [...html.matchAll(/<article class="quote-card searchable"[\s\S]*?>/g)];

  for (const match of cards) {
    const tag = match[0];
    const reviewId = normalizeText(getAttr(tag, "data-review-id"));
    if (!reviewId) {
      continue;
    }

    const rawExcluded = normalizeText(getAttr(tag, "data-default-excluded")).toLowerCase();
    const excluded = rawExcluded === "true" || rawExcluded === "1" || rawExcluded === "yes";
    const tags = parseTagList(normalizeText(getAttr(tag, "data-default-tags")));
    const existing = reviewStates[reviewId];

    if (!existing) {
      reviewStates[reviewId] = {
        excluded,
        tags,
        updatedAt
      };
      continue;
    }

    // If any card for the same review is active by default, keep it active.
    existing.excluded = existing.excluded && excluded;
    existing.tags = mergeTags(existing.tags, tags);
    existing.updatedAt = updatedAt;
  }

  return {
    sourceCount: cards.length,
    reviewStates
  };
}

function extractReviewDefaultsFromBundle(bundle: ReportBundlePayload, updatedAt: string): {
  sourceCount: number;
  reviewStates: Record<string, ReviewStateEntry>;
} {
  const reviewStates: Record<string, ReviewStateEntry> = {};
  const rawDefaults =
    bundle.reviewDefaults && typeof bundle.reviewDefaults === "object"
      ? (bundle.reviewDefaults as Record<string, { excluded?: unknown; tags?: unknown }>)
      : {};

  for (const [reviewIdRaw, row] of Object.entries(rawDefaults)) {
    const reviewId = normalizeText(reviewIdRaw);
    if (!reviewId) {
      continue;
    }

    reviewStates[reviewId] = {
      excluded: Boolean(row?.excluded),
      tags: normalizeReviewTags(row?.tags),
      updatedAt
    };
  }

  return {
    sourceCount: Object.keys(reviewStates).length,
    reviewStates
  };
}

function normalizeBacklogNotes(input: unknown): Record<string, BacklogNoteEntry> {
  if (!input || typeof input !== "object") {
    return {};
  }

  const source = input as Record<string, unknown>;
  const result: Record<string, BacklogNoteEntry> = {};

  for (const [appKeyRaw, row] of Object.entries(source)) {
    const appKey = normalizeText(appKeyRaw);
    if (!appKey || !row || typeof row !== "object") {
      continue;
    }

    const payload = row as Record<string, unknown>;
    const content = normalizeText(typeof payload.content === "string" ? payload.content : "");
    if (!content) {
      continue;
    }

    result[appKey] = {
      content,
      updatedAt: normalizeText(typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString())
    };
  }

  return result;
}

async function readExistingBacklogNotes(outputPath: string): Promise<Record<string, BacklogNoteEntry>> {
  try {
    const raw = await fs.readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return normalizeBacklogNotes(parsed.backlogNotes);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

async function parseArgs(): Promise<CliArgs> {
  const argv = await yargs(hideBin(process.argv))
    .scriptName("report:init-state")
    .usage("$0 --my-app <owner> [options]")
    .option("my-app", {
      type: "string",
      describe: "Owner app id/slug/name/bundleId/packageName (required unless --all)"
    })
    .option("all", {
      type: "boolean",
      default: false,
      describe: "Initialize preview-state for all apps that have a rendered report bundle JSON"
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
      describe: "Input bundle/html path (default: data/{myAppId}/reports/competitor-raw-actionable.ko.json)"
    })
    .option("output", {
      type: "string",
      describe: "Output preview-state path (default: data/{myAppId}/reports/preview-state.json)"
    })
    .option("keep-notes", {
      type: "boolean",
      default: true,
      describe: "Keep existing backlog notes from preview-state.json"
    })
    .help()
    .strict()
    .parse();

  return argv as unknown as CliArgs;
}

function resolveDefaultInputPath(dataRoot: string, ownerAppId: string): string {
  return path.resolve(dataRoot, ownerAppId, "reports", DEFAULT_INPUT_FILE_NAME);
}

function resolveDefaultOutputPath(dataRoot: string, ownerAppId: string): string {
  return path.resolve(dataRoot, ownerAppId, "reports", PREVIEW_STATE_FILE_NAME);
}

async function listAllTargetApps(dataRoot: string): Promise<string[]> {
  const entries = await fs.readdir(dataRoot, { withFileTypes: true }).catch(() => []);
  const apps: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const appId = entry.name;
    const htmlPath = resolveDefaultInputPath(dataRoot, appId);
    const exists = await fs
      .access(htmlPath)
      .then(() => true)
      .catch(() => false);

    if (exists) {
      apps.push(appId);
    }
  }

  return apps.sort((a, b) => a.localeCompare(b));
}

async function initPreviewStateForApp(params: {
  ownerAppId: string;
  inputPath: string;
  outputPath: string;
  keepNotes: boolean;
}): Promise<InitResult> {
  const { ownerAppId, inputPath, outputPath, keepNotes } = params;
  const rawInput = await fs.readFile(inputPath, "utf8");
  const now = new Date().toISOString();
  let extracted:
    | {
        sourceCount: number;
        reviewStates: Record<string, ReviewStateEntry>;
      }
    | undefined;

  const ext = path.extname(inputPath).toLowerCase();
  if (ext === ".json") {
    const parsed = JSON.parse(rawInput) as ReportBundlePayload;
    const fromBundle = extractReviewDefaultsFromBundle(parsed, now);
    if (fromBundle.sourceCount > 0) {
      extracted = fromBundle;
    } else if (normalizeText(parsed.html)) {
      extracted = extractReviewDefaultsFromHtml(String(parsed.html), now);
    }
  } else {
    extracted = extractReviewDefaultsFromHtml(rawInput, now);
  }

  if (!extracted) {
    throw new Error(`No review defaults found in input: ${inputPath}`);
  }

  const reviewIds = Object.keys(extracted.reviewStates).sort((a, b) => a.localeCompare(b));

  if (reviewIds.length === 0) {
    throw new Error(`No review defaults found in input: ${inputPath}`);
  }

  const reviews: Record<string, ReviewStateEntry> = {};
  for (const reviewId of reviewIds) {
    reviews[reviewId] = extracted.reviewStates[reviewId];
  }

  const backlogNotes = keepNotes ? await readExistingBacklogNotes(outputPath) : {};
  const previewState: PreviewStateFile = {
    version: 3,
    ownerAppId,
    updatedAt: now,
    reviews,
    backlogNotes
  };

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(previewState, null, 2)}\n`, "utf8");

  const values = Object.values(reviews);
  const activeCount = values.filter((row) => !row.excluded).length;
  const inactiveCount = values.length - activeCount;

  return {
    ownerAppId,
    inputPath,
    outputPath,
    sourceCount: extracted.sourceCount,
    reviewCount: values.length,
    activeCount,
    inactiveCount
  };
}

async function runSingle(argv: CliArgs): Promise<InitResult[]> {
  if (!argv.myApp) {
    throw new Error("--my-app is required unless --all is used");
  }

  const resolved = await resolveOwnerApp(argv.myApp, argv.registeredAppsPath);
  const ownerAppId = resolved.ownerAppId;
  const dataRoot = resolveDataRoot(argv.dataDir);
  const inputPath = argv.input ? path.resolve(process.cwd(), argv.input) : resolveDefaultInputPath(dataRoot, ownerAppId);
  const outputPath = argv.output
    ? path.resolve(process.cwd(), argv.output)
    : resolveDefaultOutputPath(dataRoot, ownerAppId);

  const result = await initPreviewStateForApp({
    ownerAppId,
    inputPath,
    outputPath,
    keepNotes: argv.keepNotes
  });

  return [result];
}

async function runAll(argv: CliArgs): Promise<InitResult[]> {
  if (argv.myApp || argv.input || argv.output) {
    throw new Error("--all cannot be combined with --my-app, --input, or --output");
  }

  const dataRoot = resolveDataRoot(argv.dataDir);
  const apps = await listAllTargetApps(dataRoot);

  if (!apps.length) {
    throw new Error(`No apps found with ${DEFAULT_INPUT_FILE_NAME} under ${dataRoot}`);
  }

  const results: InitResult[] = [];
  for (const ownerAppId of apps) {
    const result = await initPreviewStateForApp({
      ownerAppId,
      inputPath: resolveDefaultInputPath(dataRoot, ownerAppId),
      outputPath: resolveDefaultOutputPath(dataRoot, ownerAppId),
      keepNotes: argv.keepNotes
    });
    results.push(result);
  }

  return results;
}

function printSummary(results: InitResult[]): void {
  const appCount = results.length;
  const totalSource = results.reduce((sum, item) => sum + item.sourceCount, 0);
  const totalReviews = results.reduce((sum, item) => sum + item.reviewCount, 0);
  const totalActive = results.reduce((sum, item) => sum + item.activeCount, 0);
  const totalInactive = results.reduce((sum, item) => sum + item.inactiveCount, 0);

  console.log("[report:init-state]");
  console.log(`- apps: ${appCount}`);
  console.log(`- defaults parsed: ${totalSource}`);
  console.log(`- reviews seeded: ${totalReviews}`);
  console.log(`- active defaults: ${totalActive}`);
  console.log(`- inactive defaults: ${totalInactive}`);

  for (const result of results) {
    console.log(
      `- ${result.ownerAppId}: reviews=${result.reviewCount} (active=${result.activeCount}, inactive=${result.inactiveCount})`
    );
    console.log(`  input: ${result.inputPath}`);
    console.log(`  output: ${result.outputPath}`);
  }
}

async function main(): Promise<void> {
  const argv = await parseArgs();
  const results = argv.all ? await runAll(argv) : await runSingle(argv);
  printSummary(results);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[report:init-state] ERROR: ${message}`);
  process.exitCode = 1;
});
