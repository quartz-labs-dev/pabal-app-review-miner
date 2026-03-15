#!/usr/bin/env node

import gplay, { IAppItem } from "google-play-scraper";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { fetchAppStoreReviews } from "./appStoreReviews";
import { includesIos, includesPlay, PlatformMode } from "./platform";
import { fetchPlayReviews } from "./playReviews";
import { resolveOwnerApp } from "./registeredApps";
import {
  DEFAULT_STORE_COUNTRY,
  DEFAULT_STORE_LANG,
  getIosCountries,
  getPlayMarkets
} from "./storeLocale";
import {
  AppTarget,
  createAppStoreAppUrl,
  createOutputPaths,
  createPlayStoreAppUrl,
  dedupeReviews,
  DEFAULT_REVIEW_LIMIT,
  fetchJsonWithRetry,
  normalizeText,
  readJsonFile,
  ReviewsOutput,
  safeFileName,
  UnifiedReview,
  writeJsonFile
} from "./utils";

type OutputMode = "text" | "json";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  name?: string;
  playId?: string;
  iosId?: string;
  platform: PlatformMode;
  limit: number;
  global: boolean;
  appendExisting: boolean;
  output: OutputMode;
}

interface ITunesSearchResult {
  trackId?: number;
  trackName?: string;
}

interface ITunesSearchResponse {
  results?: ITunesSearchResult[];
}

interface ResolvedStoreIds {
  playId?: string;
  playTitle?: string;
  iosId?: string;
  iosTitle?: string;
}

function resolveGlobalMode(rawArgv: string[]): boolean {
  let mode = true;

  for (const token of rawArgv) {
    if (token === "--global" || token === "--global=true") {
      mode = true;
      continue;
    }

    if (token === "--no-global" || token === "--global=false") {
      mode = false;
      continue;
    }

    if (token.startsWith("--global=")) {
      const value = token.slice("--global=".length).trim().toLowerCase();
      if (["true", "1", "yes"].includes(value)) {
        mode = true;
      } else if (["false", "0", "no"].includes(value)) {
        mode = false;
      }
    }
  }

  return mode;
}

function createIosSearchUrl(term: string, country: string): string {
  return (
    `https://itunes.apple.com/search?entity=software` +
    `&term=${encodeURIComponent(term)}` +
    `&country=${encodeURIComponent(country)}` +
    `&limit=25`
  );
}

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

function scoreTitle(title: string, term: string, index: number): number {
  const normalizedTitle = normalizeText(title).toLowerCase();
  const normalizedTerm = normalizeText(term).toLowerCase();

  let score = 0;
  if (!normalizedTitle) {
    score -= 1000;
  }

  if (normalizedTitle === normalizedTerm) {
    score += 2000;
  } else if (normalizedTitle.startsWith(normalizedTerm)) {
    score += 1000;
  } else if (normalizedTitle.includes(normalizedTerm)) {
    score += 500;
  }

  // Favor higher-ranked search entries.
  score += Math.max(0, 100 - index);
  return score;
}

function pickBestPlayResult(results: IAppItem[], term: string): IAppItem | undefined {
  let best: IAppItem | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < results.length; index += 1) {
    const candidate = results[index];
    const appId = normalizeText(candidate.appId);
    if (!appId) {
      continue;
    }

    const score = scoreTitle(normalizeText(candidate.title), term, index);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function pickBestIosResult(results: ITunesSearchResult[], term: string): ITunesSearchResult | undefined {
  let best: ITunesSearchResult | undefined;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < results.length; index += 1) {
    const candidate = results[index];
    const trackId = String(candidate.trackId ?? "").trim();
    if (!trackId) {
      continue;
    }

    const score = scoreTitle(normalizeText(candidate.trackName), term, index);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

async function resolveStoreIds(
  term: string,
  playIdOverride: string | undefined,
  iosIdOverride: string | undefined,
  platform: PlatformMode
): Promise<ResolvedStoreIds> {
  const resolved: ResolvedStoreIds = {};
  const country = DEFAULT_STORE_COUNTRY;
  const lang = DEFAULT_STORE_LANG;

  if (includesPlay(platform)) {
    if (normalizeText(playIdOverride)) {
      resolved.playId = normalizeText(playIdOverride);
    } else {
      const playResults = await gplay.search({
        term,
        num: 25,
        country,
        lang
      });
      const bestPlay = pickBestPlayResult(playResults, term);
      resolved.playId = normalizeText(bestPlay?.appId) || undefined;
      resolved.playTitle = normalizeText(bestPlay?.title) || undefined;
    }
  }

  if (includesIos(platform)) {
    if (normalizeText(iosIdOverride)) {
      resolved.iosId = normalizeText(iosIdOverride);
    } else {
      const iosPayload = await fetchJsonWithRetry<ITunesSearchResponse>(createIosSearchUrl(term, country));
      const iosResults = Array.isArray(iosPayload.results) ? iosPayload.results : [];
      const bestIos = pickBestIosResult(iosResults, term);
      resolved.iosId = normalizeText(String(bestIos?.trackId ?? "")) || undefined;
      resolved.iosTitle = normalizeText(bestIos?.trackName) || undefined;
    }
  }

  return resolved;
}

function createTargetName(query: string, ids: ResolvedStoreIds): string {
  const parts = ["manual"];
  if (ids.playId) {
    parts.push(`play-${ids.playId}`);
  }
  if (ids.iosId) {
    parts.push(`ios-${ids.iosId}`);
  }

  if (parts.length === 1) {
    parts.push(safeFileName(query));
  }

  return parts.join("__");
}

async function collectReviews(target: AppTarget, limit: number, globalMode: boolean, logger: ReturnType<typeof createLogger>) {
  const merged: UnifiedReview[] = [];
  const playMarkets = getPlayMarkets(globalMode);
  const iosCountries = getIosCountries(globalMode);

  if (target.play) {
    for (const market of playMarkets) {
      try {
        const play = await fetchPlayReviews(target.play, limit, {
          country: market.country,
          lang: market.lang
        });
        merged.push(...play.reviews.map((review) => ({ ...review, source: "play" as const })));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!globalMode) {
          throw error;
        }
        logger.warn(`[play ${target.play}] skipped ${market.country}/${market.lang}: ${message}`);
      }
    }
  }

  if (target.ios) {
    for (const country of iosCountries) {
      try {
        const ios = await fetchAppStoreReviews(target.ios, limit, { country });
        merged.push(...ios.reviews.map((review) => ({ ...review, source: "ios" as const })));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!globalMode) {
          throw error;
        }
        logger.warn(`[ios ${target.ios}] skipped ${country}: ${message}`);
      }
    }
  }

  return dedupeReviews(merged);
}

async function parseArgs(): Promise<CliArgs> {
  const parsed = await yargs(hideBin(process.argv))
    .scriptName("review:collect-by-name")
    .usage("$0 --my-app <owner> --name \"App Name\" [options]")
    .option("my-app", {
      type: "string",
      demandOption: true,
      describe: "Owner app key (slug/name/bundleId/packageName/appId)"
    })
    .option("registered-apps-path", {
      type: "string",
      describe: "Path to registered-apps.json (default: ~/.config/pabal-mcp/registered-apps.json)"
    })
    .option("name", {
      type: "string",
      demandOption: true,
      describe: "App name query used to search both stores"
    })
    .option("play-id", {
      type: "string",
      describe: "Optional Play appId override"
    })
    .option("ios-id", {
      type: "string",
      describe: "Optional App Store id override"
    })
    .option("platform", {
      choices: ["both", "ios", "android"] as const,
      default: "both",
      describe: "Review source platform filter (default: both)"
    })
    .option("limit", {
      type: "number",
      default: DEFAULT_REVIEW_LIMIT,
      describe: "Number of reviews per market/country request"
    })
    .option("global", {
      type: "boolean",
      default: true,
      describe: "Collect reviews across global market/country lists"
    })
    .option("append-existing", {
      type: "boolean",
      default: false,
      describe:
        "Merge newly fetched reviews with existing output file and dedupe by reviewId. Useful for incremental accumulation across runs."
    })
    .option("output", {
      choices: ["text", "json"] as const,
      default: "text",
      describe: "Output format"
    })
    .help()
    .strict()
    .parse();

  return parsed as unknown as CliArgs;
}

async function run(): Promise<void> {
  const args = await parseArgs();
  args.global = resolveGlobalMode(process.argv.slice(2));
  const logger = createLogger(args.output);
  const owner = await resolveOwnerApp(args.myApp ?? "", args.registeredAppsPath);
  const term = normalizeText(args.name);

  const ids = await resolveStoreIds(term, args.playId, args.iosId, args.platform);
  if (!ids.playId && !ids.iosId) {
    throw new Error(
      `No store app ids found for "${term}" with --platform=${args.platform}. ` +
        "Provide matching --play-id/--ios-id or switch --platform."
    );
  }

  const appName = ids.playTitle || ids.iosTitle || term;
  const target: AppTarget = {
    name: createTargetName(term, ids),
    displayName: appName,
    play: ids.playId,
    ios: ids.iosId
  };

  logger.info(
    `[resolve] ${term} -> play=${target.play ?? "-"} ios=${target.ios ?? "-"} ` +
      `(platform=${args.platform}, global=${String(args.global)})`
  );

  const reviews = await collectReviews(target, args.limit, Boolean(args.global), logger);
  const outputPath = createOutputPaths(process.cwd(), owner.ownerAppId, target.name).reviewsPath;
  let mergedReviews = dedupeReviews(reviews);

  if (args.appendExisting) {
    try {
      const existing = await readJsonFile<Partial<ReviewsOutput>>(outputPath);
      const existingReviews = Array.isArray(existing.reviews) ? (existing.reviews as UnifiedReview[]) : [];
      mergedReviews = dedupeReviews([...mergedReviews, ...existingReviews]);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code !== "ENOENT") {
        logger.warn(`[append] failed to read existing output: ${nodeError.message}`);
      }
    }
  }

  const payload: ReviewsOutput = {
    ownerAppId: owner.ownerAppId,
    app: target.name,
    appName: target.displayName || target.name,
    collectedAt: new Date().toISOString(),
    limitPerStore: args.limit,
    ids: {
      play: target.play,
      ios: target.ios
    },
    links: {
      play: createPlayStoreAppUrl(target.play),
      ios: createAppStoreAppUrl(target.ios)
    },
    counts: {
      play: mergedReviews.filter((review) => review.source === "play").length,
      ios: mergedReviews.filter((review) => review.source === "ios").length,
      total: mergedReviews.length
    },
    reviews: mergedReviews
  };

  await writeJsonFile(outputPath, payload);

  if (args.output === "json") {
    console.log(
      JSON.stringify(
        {
          ok: true,
          ownerAppId: owner.ownerAppId,
          query: term,
          target,
          outputPath,
          appendExisting: args.appendExisting,
          counts: payload.counts
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`[saved] ${outputPath}`);
  console.log(
    `[counts] play=${payload.counts.play} ios=${payload.counts.ios} total=${payload.counts.total}`
  );
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
