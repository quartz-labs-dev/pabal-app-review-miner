#!/usr/bin/env node

import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { enrichTargetsWithDisplayNames } from "./appMetadata";
import { fetchAppStoreReviews } from "./appStoreReviews";
import { discoverCompetitorTargets } from "./competitorDiscovery";
import { fetchPlayReviews } from "./playReviews";
import { resolveOwnerApp, ResolvedOwnerApp } from "./registeredApps";
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
  readJsonFile,
  removeFileIfExists,
  ReviewsOutput,
  UnifiedReview,
  writeJsonFile
} from "./utils";

type OutputMode = "text" | "json";
type AppStatus = "ok" | "failed" | "skipped";

interface CliArgs {
  _: (string | number)[];
  appName?: string;
  myApp?: string;
  registeredAppsPath?: string;
  play?: string;
  ios?: string;
  autoTop: number;
  limit: number;
  apps?: string;
  output: OutputMode;
  global?: boolean;
  dryRun?: boolean;
  validateOnly?: boolean;
}

interface AppProcessResult {
  app: string;
  appName: string;
  status: AppStatus;
  mode: "run" | "dry-run" | "validate-only";
  play?: string;
  ios?: string;
  outputPath?: string;
  reviewCount?: number;
  message?: string;
}

interface RunSummary {
  succeeded: number;
  failed: number;
  skipped: number;
}

interface RunReport {
  ok: boolean;
  ownerAppId: string;
  autoDiscoveryUsed: boolean;
  output: OutputMode;
  dryRun: boolean;
  validateOnly: boolean;
  global: boolean;
  limit: number;
  summary: RunSummary;
  results: AppProcessResult[];
}

interface AutoDiscoveryPlan {
  perStoreTarget: number;
  requirePlay: boolean;
  requireIos: boolean;
  minReviewsExclusive: number;
  candidatePoolTopPerStore: number;
}

const AUTO_DISCOVERY_POOL_MULTIPLIER = 5;
const AUTO_DISCOVERY_POOL_MAX_PER_STORE = 50;
const AUTO_MIN_REVIEWS_EXCLUSIVE = 30;

function createLogger(outputMode: OutputMode) {
  if (outputMode === "json") {
    return {
      info(_message: string): void {
        // no-op
      },
      warn(_message: string): void {
        // no-op
      },
      error(_message: string): void {
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
    },
    error(message: string): void {
      console.error(message);
    }
  };
}

function normalizeTarget(raw: AppTarget, index: number): AppTarget {
  const name = (raw.name ?? "").trim();
  if (!name) {
    throw new Error(`apps.json item at index ${index} is missing a valid "name"`);
  }

  const displayName = (raw.displayName ?? "").trim();

  return {
    name,
    displayName,
    play: raw.play,
    ios: raw.ios
  };
}

function readRawRequestedAppName(argv: CliArgs): string {
  const raw = argv.appName || (typeof argv._[0] === "string" ? String(argv._[0]) : "");
  return raw.trim();
}

function resolveRequestedAppName(argv: CliArgs): string {
  return readRawRequestedAppName(argv) || "app";
}

async function parseArgs(): Promise<CliArgs> {
  const parsed = await yargs(hideBin(process.argv))
    .scriptName("pabal-app-review-miner")
    .command("$0 [appName]", "Collect raw reviews for one app or apps.json list", (command) =>
      command.positional("appName", {
        type: "string",
        describe: "Output app name (and shorthand lookup key in apps.json)"
      })
    )
    .usage("$0 [appName] [options]")
    .option("my-app", {
      type: "string",
      describe: "My app key used to find owner app id (slug/name/bundleId/packageName/appId)",
      demandOption: true
    })
    .option("registered-apps-path", {
      type: "string",
      describe: "Path to registered-apps.json (default: ~/.config/pabal-mcp/registered-apps.json)"
    })
    .option("play", {
      type: "string",
      describe: "Google Play app id"
    })
    .option("ios", {
      type: "string",
      describe: "App Store app id"
    })
    .option("auto-top", {
      type: "number",
      default: 5,
      describe: "Top N competitors per available store when only --my-app is provided"
    })
    .option("limit", {
      type: "number",
      default: DEFAULT_REVIEW_LIMIT,
      describe: "Number of reviews per source"
    })
    .option("apps", {
      type: "string",
      describe: "Path to apps.json for multi-app mode"
    })
    .option("output", {
      choices: ["text", "json"] as const,
      default: "text",
      describe: "Output format for agent-friendly consumption"
    })
    .option("global", {
      type: "boolean",
      default: true,
      describe:
        "Collect reviews market-by-market using store-specific global market lists (Play country+lang, App Store country). In global mode, --limit applies per market."
    })
    .option("dry-run", {
      type: "boolean",
      default: false,
      describe: "Plan actions without fetching or writing files"
    })
    .option("validate-only", {
      type: "boolean",
      default: false,
      describe: "Validate inputs/target mapping only (no fetch, no write)"
    })
    .help()
    .strict()
    .parse();

  return parsed as unknown as CliArgs;
}

async function loadTargetsFromAppsFile(appsPath: string): Promise<AppTarget[]> {
  const resolved = path.resolve(process.cwd(), appsPath);
  const apps = await readJsonFile<AppTarget[]>(resolved);

  if (!Array.isArray(apps) || apps.length === 0) {
    throw new Error(`No app targets found in ${resolved}`);
  }

  return apps.map((item, index) => normalizeTarget(item, index));
}

async function loadSingleTarget(argv: CliArgs): Promise<AppTarget> {
  const appName = resolveRequestedAppName(argv);

  if (argv.play || argv.ios) {
    return {
      name: appName,
      play: argv.play,
      ios: argv.ios
    };
  }

  const defaultAppsPath = path.resolve(process.cwd(), "apps.json");
  try {
    const apps = await readJsonFile<AppTarget[]>(defaultAppsPath);
    const matched = apps.find((item) => item.name === appName);
    if (matched) {
      return normalizeTarget(matched, 0);
    }
  } catch {
    // Ignore missing/invalid default apps file.
  }

  throw new Error(
    `Provide --play and/or --ios, or use --apps <apps.json>. ` +
      `Tip: add "${appName}" to ${defaultAppsPath} for shorthand usage.`
  );
}

function hasExplicitPositionalAppName(argv: CliArgs): boolean {
  return readRawRequestedAppName(argv).length > 0;
}

function normalizeAutoTop(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error("--auto-top must be a finite number greater than or equal to 1.");
  }

  const normalized = Math.floor(value);
  if (normalized < 1) {
    throw new Error("--auto-top must be greater than or equal to 1.");
  }

  return normalized;
}

async function loadTargets(
  argv: CliArgs,
  owner: ResolvedOwnerApp,
  logger: ReturnType<typeof createLogger>
): Promise<{ targets: AppTarget[]; autoDiscoveryUsed: boolean; autoPlan?: AutoDiscoveryPlan }> {
  if (argv.apps) {
    return {
      targets: await loadTargetsFromAppsFile(argv.apps),
      autoDiscoveryUsed: false,
      autoPlan: undefined
    };
  }

  const hasDirectStoreIds = Boolean(argv.play || argv.ios);
  if (hasDirectStoreIds || hasExplicitPositionalAppName(argv)) {
    return {
      targets: [await loadSingleTarget(argv)],
      autoDiscoveryUsed: false,
      autoPlan: undefined
    };
  }

  const top = normalizeAutoTop(argv.autoTop);
  const requirePlay = Boolean(owner.play);
  const requireIos = Boolean(owner.ios);
  const candidatePoolTopPerStore = Math.min(AUTO_DISCOVERY_POOL_MAX_PER_STORE, top * AUTO_DISCOVERY_POOL_MULTIPLIER);
  const targets = await discoverCompetitorTargets({
    ownerPlayAppId: owner.play,
    ownerIosAppId: owner.ios,
    top: candidatePoolTopPerStore,
    country: DEFAULT_STORE_COUNTRY,
    lang: DEFAULT_STORE_LANG
  });

  if (!targets.length) {
    throw new Error(
      "Auto competitor discovery returned no targets. " +
        "Provide --apps/--play/--ios explicitly or verify owner ids in registered-apps.json."
    );
  }

  logger.info(
    `[auto] Discovered ${targets.length} competitors ` +
      `(candidate pool top ${candidatePoolTopPerStore} per available store, keep top ${top} per store).`
  );

  return {
    targets,
    autoDiscoveryUsed: true,
    autoPlan: {
      perStoreTarget: top,
      requirePlay,
      requireIos,
      minReviewsExclusive: AUTO_MIN_REVIEWS_EXCLUSIVE,
      candidatePoolTopPerStore
    }
  };
}

async function collectReviews(
  target: AppTarget,
  limit: number,
  options: {
    globalMode: boolean;
    logger: ReturnType<typeof createLogger>;
    prefix: string;
  }
): Promise<UnifiedReview[]> {
  const merged: UnifiedReview[] = [];
  let attempts = 0;
  let successfulRequests = 0;

  const playMarkets = getPlayMarkets(options.globalMode);
  const iosCountries = getIosCountries(options.globalMode);

  if (target.play) {
    for (const market of playMarkets) {
      attempts += 1;
      try {
        const play = await fetchPlayReviews(target.play, limit, {
          country: market.country,
          lang: market.lang
        });

        merged.push(...play.reviews.map((review) => ({ ...review, source: "play" as const })));
        successfulRequests += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!options.globalMode) {
          throw error;
        }

        options.logger.warn(
          `${options.prefix} skipped Google Play market ${market.country}/${market.lang}: ${message}`
        );
      }
    }
  }

  if (target.ios) {
    for (const country of iosCountries) {
      attempts += 1;
      try {
        const ios = await fetchAppStoreReviews(target.ios, limit, {
          country
        });

        merged.push(...ios.reviews.map((review) => ({ ...review, source: "ios" as const })));
        successfulRequests += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!options.globalMode) {
          throw error;
        }

        options.logger.warn(`${options.prefix} skipped App Store country ${country}: ${message}`);
      }
    }
  }

  if (attempts > 0 && successfulRequests === 0) {
    throw new Error("All market requests failed.");
  }

  return dedupeReviews(merged);
}

async function saveReviews(
  baseDir: string,
  ownerAppId: string,
  target: AppTarget,
  limit: number,
  reviews: UnifiedReview[]
): Promise<string> {
  const paths = createOutputPaths(baseDir, ownerAppId, target.name);
  const appName = target.displayName || target.name;

  const payload: ReviewsOutput = {
    ownerAppId,
    app: target.name,
    appName,
    collectedAt: new Date().toISOString(),
    limitPerStore: limit,
    ids: {
      play: target.play,
      ios: target.ios
    },
    links: {
      play: createPlayStoreAppUrl(target.play),
      ios: createAppStoreAppUrl(target.ios)
    },
    counts: {
      play: reviews.filter((review) => review.source === "play").length,
      ios: reviews.filter((review) => review.source === "ios").length,
      total: reviews.length
    },
    reviews
  };

  await writeJsonFile(paths.reviewsPath, payload);
  return paths.reviewsPath;
}

async function processApp(
  baseDir: string,
  ownerAppId: string,
  target: AppTarget,
  limit: number,
  options: {
    dryRun: boolean;
    validateOnly: boolean;
    globalMode: boolean;
    minReviewsExclusive?: number;
    logger: ReturnType<typeof createLogger>;
  }
): Promise<AppProcessResult> {
  const logger = options.logger;
  const appName = target.displayName || target.name;
  const prefix = `[${appName}]`;
  const outputPath = createOutputPaths(baseDir, ownerAppId, target.name).reviewsPath;

  if (!target.play && !target.ios) {
    const message = "skipped: no play/ios id";
    logger.warn(`${prefix} ${message}`);

    return {
      app: target.name,
      appName,
      status: "skipped",
      mode: options.validateOnly ? "validate-only" : options.dryRun ? "dry-run" : "run",
      play: target.play,
      ios: target.ios,
      outputPath,
      message
    };
  }

  if (options.validateOnly) {
    return {
      app: target.name,
      appName,
      status: "ok",
      mode: "validate-only",
      play: target.play,
      ios: target.ios,
      outputPath,
      message: "validated target configuration"
    };
  }

  if (options.dryRun) {
    return {
      app: target.name,
      appName,
      status: "ok",
      mode: "dry-run",
      play: target.play,
      ios: target.ios,
      outputPath,
      message: "would fetch and write reviews"
    };
  }

  try {
    if (target.play) {
      logger.info(
        `${prefix} Fetching Google Play reviews: ${target.play}${options.globalMode ? " (global markets)" : ""}`
      );
    }

    if (target.ios) {
      logger.info(`${prefix} Fetching App Store reviews: ${target.ios}${options.globalMode ? " (global countries)" : ""}`);
    }

    const reviews = await collectReviews(target, limit, {
      globalMode: options.globalMode,
      logger,
      prefix
    });

    if (typeof options.minReviewsExclusive === "number" && reviews.length <= options.minReviewsExclusive) {
      const message = `skipped: ${reviews.length} reviews (<= ${options.minReviewsExclusive})`;
      await removeFileIfExists(outputPath);
      logger.warn(`${prefix} ${message}`);

      return {
        app: target.name,
        appName,
        status: "skipped",
        mode: "run",
        play: target.play,
        ios: target.ios,
        outputPath,
        reviewCount: reviews.length,
        message
      };
    }

    await saveReviews(baseDir, ownerAppId, target, limit, reviews);

    logger.info(`${prefix} Saved ${reviews.length} reviews -> ${outputPath}`);

    return {
      app: target.name,
      appName,
      status: "ok",
      mode: "run",
      play: target.play,
      ios: target.ios,
      outputPath,
      reviewCount: reviews.length
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`${prefix} failed: ${message}`);

    return {
      app: target.name,
      appName,
      status: "failed",
      mode: "run",
      play: target.play,
      ios: target.ios,
      outputPath,
      message
    };
  }
}

function summarize(results: AppProcessResult[]): RunSummary {
  return {
    succeeded: results.filter((result) => result.status === "ok").length,
    failed: results.filter((result) => result.status === "failed").length,
    skipped: results.filter((result) => result.status === "skipped").length
  };
}

function printTextSummary(ownerAppId: string, summary: RunSummary, argv: CliArgs, autoDiscoveryUsed: boolean): void {
  if (argv.validateOnly) {
    console.log("\nValidation summary");
  } else if (argv.dryRun) {
    console.log("\nDry-run summary");
  } else {
    console.log("\nRun summary");
  }

  console.log(`- ownerAppId: ${ownerAppId}`);
  console.log(`- autoDiscoveryUsed: ${autoDiscoveryUsed}`);
  console.log(`- global: ${Boolean(argv.global)}`);
  console.log(`- succeeded: ${summary.succeeded}`);
  console.log(`- failed: ${summary.failed}`);
  console.log(`- skipped: ${summary.skipped}`);
}

function getPrimaryStoreKey(target: AppTarget): "play" | "ios" | null {
  if (target.play && !target.ios) {
    return "play";
  }

  if (target.ios && !target.play) {
    return "ios";
  }

  if (target.play) {
    return "play";
  }

  if (target.ios) {
    return "ios";
  }

  return null;
}

function getStoreKeyFromResult(result: AppProcessResult): "play" | "ios" | null {
  if (result.play && !result.ios) {
    return "play";
  }

  if (result.ios && !result.play) {
    return "ios";
  }

  if (result.play) {
    return "play";
  }

  if (result.ios) {
    return "ios";
  }

  return null;
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

async function run(): Promise<void> {
  const argv = await parseArgs();
  const logger = createLogger(argv.output);
  const globalMode = resolveGlobalMode(process.argv.slice(2));
  argv.global = globalMode;

  const owner = await resolveOwnerApp(argv.myApp ?? "", argv.registeredAppsPath);
  const ownerAppId = owner.ownerAppId;
  const { targets, autoDiscoveryUsed, autoPlan } = await loadTargets(argv, owner, logger);
  const targetsWithNames = await enrichTargetsWithDisplayNames(targets, DEFAULT_STORE_COUNTRY, DEFAULT_STORE_LANG);
  const targetByName = new Map(targetsWithNames.map((target) => [target.name, target]));

  const results: AppProcessResult[] = [];
  const upsertResult = (result: AppProcessResult): void => {
    const index = results.findIndex((item) => item.app === result.app);
    if (index >= 0) {
      results[index] = result;
      return;
    }

    results.push(result);
  };
  const shouldApplyAutoThreshold = autoDiscoveryUsed && Boolean(autoPlan) && !argv.dryRun && !argv.validateOnly;

  if (shouldApplyAutoThreshold && autoPlan) {
    const acceptedByStore = {
      play: 0,
      ios: 0
    };

    for (const target of targetsWithNames) {
      const storeKey = getPrimaryStoreKey(target);
      if (!storeKey) {
        continue;
      }

      if (
        (storeKey === "play" && autoPlan.requirePlay && acceptedByStore.play >= autoPlan.perStoreTarget) ||
        (storeKey === "ios" && autoPlan.requireIos && acceptedByStore.ios >= autoPlan.perStoreTarget)
      ) {
        continue;
      }

      const result = await processApp(process.cwd(), ownerAppId, target, argv.limit, {
        dryRun: false,
        validateOnly: false,
        globalMode,
        minReviewsExclusive: autoPlan.minReviewsExclusive,
        logger
      });

      upsertResult(result);

      if (result.status === "ok") {
        if (storeKey === "play") {
          acceptedByStore.play += 1;
        } else {
          acceptedByStore.ios += 1;
        }
      }

      const playDone = !autoPlan.requirePlay || acceptedByStore.play >= autoPlan.perStoreTarget;
      const iosDone = !autoPlan.requireIos || acceptedByStore.ios >= autoPlan.perStoreTarget;
      if (playDone && iosDone) {
        break;
      }
    }

    const playDone = !autoPlan.requirePlay || acceptedByStore.play >= autoPlan.perStoreTarget;
    const iosDone = !autoPlan.requireIos || acceptedByStore.ios >= autoPlan.perStoreTarget;
    if (!playDone || !iosDone) {
      const fallbackCandidates = results
        .filter((result) => result.status === "skipped")
        .sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));

      for (const candidate of fallbackCandidates) {
        const storeKey = getStoreKeyFromResult(candidate);
        if (!storeKey) {
          continue;
        }

        if (
          (storeKey === "play" && (!autoPlan.requirePlay || acceptedByStore.play >= autoPlan.perStoreTarget)) ||
          (storeKey === "ios" && (!autoPlan.requireIos || acceptedByStore.ios >= autoPlan.perStoreTarget))
        ) {
          continue;
        }

        const target = targetByName.get(candidate.app);
        if (!target) {
          continue;
        }

        const retryResult = await processApp(process.cwd(), ownerAppId, target, argv.limit, {
          dryRun: false,
          validateOnly: false,
          globalMode,
          logger
        });

        upsertResult(retryResult);

        if (retryResult.status === "ok") {
          if (storeKey === "play") {
            acceptedByStore.play += 1;
          } else {
            acceptedByStore.ios += 1;
          }
        }

        const playFilled = !autoPlan.requirePlay || acceptedByStore.play >= autoPlan.perStoreTarget;
        const iosFilled = !autoPlan.requireIos || acceptedByStore.ios >= autoPlan.perStoreTarget;
        if (playFilled && iosFilled) {
          break;
        }
      }
    }

    const playFilled = !autoPlan.requirePlay || acceptedByStore.play >= autoPlan.perStoreTarget;
    const iosFilled = !autoPlan.requireIos || acceptedByStore.ios >= autoPlan.perStoreTarget;
    if (!playFilled || !iosFilled) {
      logger.warn(
        `[auto] Unable to fill target competitor quota with review threshold > ${autoPlan.minReviewsExclusive}. ` +
          `play=${acceptedByStore.play}/${autoPlan.requirePlay ? autoPlan.perStoreTarget : 0}, ` +
          `ios=${acceptedByStore.ios}/${autoPlan.requireIos ? autoPlan.perStoreTarget : 0}`
      );
    }
  } else {
    for (const target of targetsWithNames) {
      const result = await processApp(process.cwd(), ownerAppId, target, argv.limit, {
        dryRun: Boolean(argv.dryRun),
        validateOnly: Boolean(argv.validateOnly),
        globalMode,
        logger
      });

      upsertResult(result);
    }
  }

  const summary = summarize(results);

  if (argv.output === "json") {
    const report: RunReport = {
      ok: summary.failed === 0,
      ownerAppId,
      autoDiscoveryUsed,
      output: argv.output,
      dryRun: Boolean(argv.dryRun),
      validateOnly: Boolean(argv.validateOnly),
      global: globalMode,
      limit: argv.limit,
      summary,
      results
    };

    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printTextSummary(ownerAppId, summary, argv, autoDiscoveryUsed);
}

function wantsJsonOutputFromArgv(argv: string[]): boolean {
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--output" && argv[index + 1] === "json") {
      return true;
    }

    if (token === "--output=json") {
      return true;
    }
  }

  return false;
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);

  if (wantsJsonOutputFromArgv(process.argv)) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: message
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  console.error(`Fatal error: ${message}`);
  process.exit(1);
});
