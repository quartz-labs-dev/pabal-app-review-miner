#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import { ensureDir, fetchJsonWithRetry, normalizeText, readJsonFile, ReviewsOutput, writeJsonFile } from "./utils";

type OutputMode = "text" | "json";
type TranslationProvider = "google-web" | "none";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  inputDir?: string;
  outputDir?: string;
  targetLang: string;
  provider: TranslationProvider;
  overwrite: boolean;
  concurrency: number;
  output: OutputMode;
}

interface TranslatedReview {
  rating: number;
  text: string;
  textKo: string;
  date: string;
  user: string;
  source: "play" | "ios";
  reviewId?: string;
  storeReviewId?: string;
  detectedLang?: string;
  translatedAt: string;
}

interface TranslatedReviewsOutput extends Omit<ReviewsOutput, "reviews"> {
  reviews: TranslatedReview[];
  translation: {
    provider: TranslationProvider;
    targetLang: string;
    translatedAt: string;
    sourceFile: string;
    cacheHits: number;
    translatedCount: number;
  };
}

interface TranslationResult {
  text: string;
  detectedLang?: string;
  fromCache: boolean;
}

interface GoogleTranslateResponse extends Array<unknown> {
  0?: Array<Array<unknown>>;
  2?: string;
}

interface RunResultItem {
  inputFile: string;
  outputFile: string;
  status: "ok" | "skipped" | "failed";
  reviewCount?: number;
  translatedCount?: number;
  cacheHits?: number;
  message?: string;
}

interface RunReport {
  ok: boolean;
  ownerAppId: string;
  provider: TranslationProvider;
  targetLang: string;
  summary: {
    succeeded: number;
    skipped: number;
    failed: number;
    totalReviews: number;
    translatedReviews: number;
    cacheHits: number;
  };
  results: RunResultItem[];
}

const DEFAULT_TARGET_LANG = "ko";
const DEFAULT_CONCURRENCY = 4;
const TRANSLATION_CHUNK_SIZE = 1200;

function createLogger(output: OutputMode) {
  if (output === "json") {
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

function resolvePathOrDefault(ownerAppId: string, customPath: string | undefined, folderName: string): string {
  if (normalizeText(customPath)) {
    return path.resolve(process.cwd(), String(customPath));
  }

  return path.resolve(process.cwd(), "data", ownerAppId, folderName);
}

async function parseArgs(): Promise<CliArgs> {
  const parsed = await yargs(hideBin(process.argv))
    .scriptName("report:translate")
    .usage("$0 --my-app <owner> [options]")
    .option("my-app", {
      type: "string",
      describe: "Owner app key used to resolve app slug",
      demandOption: true
    })
    .option("registered-apps-path", {
      type: "string",
      describe: "Path to registered-apps.json (default: ~/.config/pabal-mcp/registered-apps.json)"
    })
    .option("input-dir", {
      type: "string",
      describe: "Input directory containing raw review json files"
    })
    .option("output-dir", {
      type: "string",
      describe: "Output directory for translated review json files"
    })
    .option("target-lang", {
      type: "string",
      default: DEFAULT_TARGET_LANG,
      describe: "Translation target language (default: ko)"
    })
    .option("provider", {
      choices: ["google-web", "none"] as const,
      default: "google-web",
      describe: "Translation provider. google-web uses translate.googleapis.com, none copies original text"
    })
    .option("overwrite", {
      type: "boolean",
      default: false,
      describe: "Overwrite existing translated files"
    })
    .option("concurrency", {
      type: "number",
      default: DEFAULT_CONCURRENCY,
      describe: "Concurrent translation worker count"
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

async function listReviewFiles(inputDir: string): Promise<string[]> {
  const entries = await fs.readdir(inputDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.resolve(inputDir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const lines = text.split(/(?<=[.!?\n])\s+/g);
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    if (!line) {
      continue;
    }

    if (!current) {
      current = line;
      continue;
    }

    if (`${current} ${line}`.length <= maxChars) {
      current = `${current} ${line}`;
      continue;
    }

    chunks.push(current);
    current = line;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

async function translateChunkGoogleWeb(text: string, targetLang: string): Promise<{ translated: string; detectedLang?: string }> {
  const url =
    "https://translate.googleapis.com/translate_a/single" +
    `?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}` +
    `&dt=t&q=${encodeURIComponent(text)}`;

  const payload = await fetchJsonWithRetry<GoogleTranslateResponse>(url);
  const segments = Array.isArray(payload[0]) ? payload[0] : [];

  const translated = segments
    .map((segment) => (Array.isArray(segment) ? String(segment[0] ?? "") : ""))
    .join("")
    .trim();

  return {
    translated: translated || text,
    detectedLang: typeof payload[2] === "string" ? payload[2] : undefined
  };
}

async function translateWithProvider(
  text: string,
  provider: TranslationProvider,
  targetLang: string
): Promise<{ translated: string; detectedLang?: string }> {
  if (provider === "none") {
    return { translated: text, detectedLang: undefined };
  }

  const chunks = splitIntoChunks(text, TRANSLATION_CHUNK_SIZE);
  const translatedChunks: string[] = [];
  let detectedLang: string | undefined;

  for (const chunk of chunks) {
    const result = await translateChunkGoogleWeb(chunk, targetLang);
    translatedChunks.push(result.translated);
    detectedLang = detectedLang ?? result.detectedLang;
  }

  return {
    translated: translatedChunks.join(" ").trim(),
    detectedLang
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const result: R[] = new Array(items.length);
  let cursor = 0;

  const workers = new Array(Math.max(1, concurrency)).fill(0).map(async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) {
        return;
      }

      result[current] = await mapper(items[current], current);
    }
  });

  await Promise.all(workers);
  return result;
}

async function loadTranslationCache(cachePath: string): Promise<Map<string, { text: string; detectedLang?: string }>> {
  try {
    const payload = await readJsonFile<Record<string, { text: string; detectedLang?: string }>>(cachePath);
    return new Map(Object.entries(payload));
  } catch {
    return new Map();
  }
}

async function saveTranslationCache(
  cachePath: string,
  cache: Map<string, { text: string; detectedLang?: string }>
): Promise<void> {
  const data = Object.fromEntries(cache.entries());
  await writeJsonFile(cachePath, data);
}

async function translateText(
  original: string,
  provider: TranslationProvider,
  targetLang: string,
  cache: Map<string, { text: string; detectedLang?: string }>
): Promise<TranslationResult> {
  const normalized = normalizeText(original);
  if (!normalized) {
    return {
      text: "",
      detectedLang: undefined,
      fromCache: true
    };
  }

  const cached = cache.get(normalized);
  if (cached) {
    return {
      text: cached.text,
      detectedLang: cached.detectedLang,
      fromCache: true
    };
  }

  const translated = await translateWithProvider(normalized, provider, targetLang);
  cache.set(normalized, {
    text: translated.translated,
    detectedLang: translated.detectedLang
  });

  return {
    text: translated.translated,
    detectedLang: translated.detectedLang,
    fromCache: false
  };
}

async function processReviewFile(
  inputFile: string,
  outputDir: string,
  provider: TranslationProvider,
  targetLang: string,
  concurrency: number,
  overwrite: boolean,
  cache: Map<string, { text: string; detectedLang?: string }>
): Promise<RunResultItem> {
  const outputFile = path.resolve(outputDir, path.basename(inputFile));

  if (!overwrite) {
    try {
      await fs.access(outputFile);
      return {
        inputFile,
        outputFile,
        status: "skipped",
        message: "output file already exists (use --overwrite)"
      };
    } catch {
      // file does not exist
    }
  }

  try {
    const payload = await readJsonFile<ReviewsOutput>(inputFile);
    const translatedAt = new Date().toISOString();
    let cacheHits = 0;
    let translatedCount = 0;

    const translatedReviews = await mapWithConcurrency(
      payload.reviews,
      concurrency,
      async (review): Promise<TranslatedReview> => {
        const result = await translateText(review.text, provider, targetLang, cache);
        if (result.fromCache) {
          cacheHits += 1;
        } else {
          translatedCount += 1;
        }

        return {
          ...review,
          textKo: result.text,
          detectedLang: result.detectedLang,
          translatedAt
        };
      }
    );

    const translatedPayload: TranslatedReviewsOutput = {
      ...payload,
      reviews: translatedReviews,
      translation: {
        provider,
        targetLang,
        translatedAt,
        sourceFile: inputFile,
        cacheHits,
        translatedCount
      }
    };

    await writeJsonFile(outputFile, translatedPayload);

    return {
      inputFile,
      outputFile,
      status: "ok",
      reviewCount: translatedReviews.length,
      translatedCount,
      cacheHits
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      inputFile,
      outputFile,
      status: "failed",
      message
    };
  }
}

function printTextSummary(ownerAppId: string, targetLang: string, provider: TranslationProvider, report: RunReport): void {
  console.log("\nTranslation summary");
  console.log(`- ownerAppId: ${ownerAppId}`);
  console.log(`- targetLang: ${targetLang}`);
  console.log(`- provider: ${provider}`);
  console.log(`- succeeded: ${report.summary.succeeded}`);
  console.log(`- skipped: ${report.summary.skipped}`);
  console.log(`- failed: ${report.summary.failed}`);
  console.log(`- total reviews: ${report.summary.totalReviews}`);
  console.log(`- translated reviews: ${report.summary.translatedReviews}`);
  console.log(`- cache hits: ${report.summary.cacheHits}`);
}

async function main(): Promise<void> {
  const argv = await parseArgs();
  const owner = await resolveOwnerApp(String(argv.myApp), argv.registeredAppsPath);
  const ownerAppId = owner.ownerAppId;
  const logger = createLogger(argv.output);

  const inputDir = resolvePathOrDefault(ownerAppId, argv.inputDir, "reviews");
  const outputDir = resolvePathOrDefault(ownerAppId, argv.outputDir, "reviews-ko");

  await ensureDir(outputDir);

  const reviewFiles = await listReviewFiles(inputDir);
  if (!reviewFiles.length) {
    throw new Error(`No review json files found in ${inputDir}`);
  }

  const cachePath = path.resolve(outputDir, ".translation-cache.json");
  const cache = await loadTranslationCache(cachePath);

  logger.info(`ownerAppId: ${ownerAppId}`);
  logger.info(`inputDir: ${inputDir}`);
  logger.info(`outputDir: ${outputDir}`);
  logger.info(`files: ${reviewFiles.length}`);

  const results: RunResultItem[] = [];
  for (const filePath of reviewFiles) {
    logger.info(`translating: ${path.basename(filePath)}`);
    const result = await processReviewFile(
      filePath,
      outputDir,
      argv.provider,
      argv.targetLang,
      argv.concurrency,
      argv.overwrite,
      cache
    );

    if (result.status === "failed") {
      logger.warn(`failed: ${path.basename(filePath)} (${result.message})`);
    }

    results.push(result);
  }

  await saveTranslationCache(cachePath, cache);

  const summary = results.reduce(
    (acc, item) => {
      if (item.status === "ok") {
        acc.succeeded += 1;
        acc.totalReviews += item.reviewCount ?? 0;
        acc.translatedReviews += item.translatedCount ?? 0;
        acc.cacheHits += item.cacheHits ?? 0;
      } else if (item.status === "skipped") {
        acc.skipped += 1;
      } else {
        acc.failed += 1;
      }

      return acc;
    },
    {
      succeeded: 0,
      skipped: 0,
      failed: 0,
      totalReviews: 0,
      translatedReviews: 0,
      cacheHits: 0
    }
  );

  const report: RunReport = {
    ok: summary.failed === 0,
    ownerAppId,
    provider: argv.provider,
    targetLang: argv.targetLang,
    summary,
    results
  };

  if (argv.output === "json") {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printTextSummary(ownerAppId, argv.targetLang, argv.provider, report);

  if (summary.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
