#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import {
  ensureReviewId,
  listJsonFilesInDir,
  normalizeText,
  resolveOwnerDataPath,
  resolvePathOrDefault,
  writeJsonFile
} from "./utils";

type OutputMode = "text" | "json";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  inputDir?: string;
  dryRun: boolean;
  output: OutputMode;
}

interface FileResult {
  file: string;
  status: "updated" | "unchanged" | "skipped" | "failed";
  reviews?: number;
  assignedReviewIds?: number;
  message?: string;
}

interface RunReport {
  ok: boolean;
  ownerAppId: string;
  inputDir: string;
  dryRun: boolean;
  summary: {
    updated: number;
    unchanged: number;
    skipped: number;
    failed: number;
    files: number;
    reviews: number;
    assignedReviewIds: number;
  };
  results: FileResult[];
}

function createLogger(outputMode: OutputMode) {
  if (outputMode === "json") {
    return {
      info(_message: string): void {
        // no-op
      },
      warn(_message: string): void {
        // no-op
      }
    };
  }

  return {
    info(message: string): void {
      console.log(message);
    },
    warn(message: string): void {
      console.warn(message);
    }
  };
}

async function parseArgs(): Promise<CliArgs> {
  const parsed = await yargs(hideBin(process.argv))
    .scriptName("review:backfill-ids")
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
    .option("input-dir", {
      type: "string",
      describe: "Input directory containing review JSON files (default: data/{myAppId}/reviews)"
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Plan updates without writing files"
    })
    .option("output", {
      choices: ["text", "json"] as const,
      default: "text",
      describe: "Output mode"
    })
    .help()
    .strict()
    .parse();

  return parsed as unknown as CliArgs;
}

function normalizeSource(source: unknown): "play" | "ios" | undefined {
  const normalized = normalizeText(String(source ?? "")).toLowerCase();
  if (normalized === "play") {
    return "play";
  }
  if (normalized === "ios") {
    return "ios";
  }
  return undefined;
}

async function processFile(filePath: string, dryRun: boolean): Promise<FileResult> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const payload = JSON.parse(raw) as Record<string, unknown>;
    const reviews = Array.isArray(payload.reviews) ? payload.reviews : undefined;

    if (!reviews) {
      return {
        file: filePath,
        status: "skipped",
        message: "missing reviews[]"
      };
    }

    let assignedReviewIds = 0;
    let changed = false;

    const normalizedReviews = reviews.map((reviewRaw) => {
      if (!reviewRaw || typeof reviewRaw !== "object") {
        return reviewRaw;
      }

      const review = reviewRaw as Record<string, unknown>;
      const source = normalizeSource(review.source);
      if (!source) {
        return reviewRaw;
      }

      const hadReviewId = normalizeText(String(review.reviewId ?? "")).length > 0;
      const ensured = ensureReviewId({
        source,
        rating: Number(review.rating ?? 0),
        text: normalizeText(String(review.text ?? "")),
        date: normalizeText(String(review.date ?? "")),
        user: normalizeText(String(review.user ?? "anonymous")) || "anonymous",
        reviewId: normalizeText(String(review.reviewId ?? "")) || undefined,
        storeReviewId: normalizeText(String(review.storeReviewId ?? "")) || undefined
      });

      if (!hadReviewId && normalizeText(ensured.reviewId)) {
        assignedReviewIds += 1;
        changed = true;
      }

      const next = {
        ...review,
        reviewId: ensured.reviewId
      };

      if (next.reviewId !== review.reviewId) {
        changed = true;
      }

      return next;
    });

    if (!changed) {
      return {
        file: filePath,
        status: "unchanged",
        reviews: reviews.length,
        assignedReviewIds: 0
      };
    }

    if (!dryRun) {
      await writeJsonFile(filePath, {
        ...payload,
        reviews: normalizedReviews
      });
    }

    return {
      file: filePath,
      status: "updated",
      reviews: reviews.length,
      assignedReviewIds
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      file: filePath,
      status: "failed",
      message
    };
  }
}

function printTextSummary(report: RunReport): void {
  console.log("\nBackfill summary");
  console.log(`- ownerAppId: ${report.ownerAppId}`);
  console.log(`- inputDir: ${report.inputDir}`);
  console.log(`- dryRun: ${String(report.dryRun)}`);
  console.log(`- files: ${report.summary.files}`);
  console.log(`- updated: ${report.summary.updated}`);
  console.log(`- unchanged: ${report.summary.unchanged}`);
  console.log(`- skipped: ${report.summary.skipped}`);
  console.log(`- failed: ${report.summary.failed}`);
  console.log(`- reviews: ${report.summary.reviews}`);
  console.log(`- assignedReviewIds: ${report.summary.assignedReviewIds}`);
}

async function run(): Promise<void> {
  const argv = await parseArgs();
  const logger = createLogger(argv.output);
  const owner = await resolveOwnerApp(argv.myApp ?? "", argv.registeredAppsPath);
  const inputDir = resolvePathOrDefault(argv.inputDir, resolveOwnerDataPath(owner.ownerAppId, "reviews"));
  const files = await listJsonFilesInDir(inputDir);
  const results: FileResult[] = [];

  for (const filePath of files) {
    const result = await processFile(filePath, Boolean(argv.dryRun));
    results.push(result);

    if (result.status === "updated") {
      logger.info(`[updated] ${path.basename(filePath)} (+${result.assignedReviewIds ?? 0} reviewId)`);
    } else if (result.status === "unchanged") {
      logger.info(`[unchanged] ${path.basename(filePath)}`);
    } else if (result.status === "skipped") {
      logger.warn(`[skipped] ${path.basename(filePath)}: ${result.message ?? "-"}`);
    } else {
      logger.warn(`[failed] ${path.basename(filePath)}: ${result.message ?? "-"}`);
    }
  }

  const summary = {
    updated: results.filter((item) => item.status === "updated").length,
    unchanged: results.filter((item) => item.status === "unchanged").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    files: files.length,
    reviews: results.reduce((sum, item) => sum + (item.reviews ?? 0), 0),
    assignedReviewIds: results.reduce((sum, item) => sum + (item.assignedReviewIds ?? 0), 0)
  };

  const report: RunReport = {
    ok: summary.failed === 0,
    ownerAppId: owner.ownerAppId,
    inputDir,
    dryRun: Boolean(argv.dryRun),
    summary,
    results
  };

  if (argv.output === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printTextSummary(report);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
