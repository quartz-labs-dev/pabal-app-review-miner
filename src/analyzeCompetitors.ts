#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import { ensureDir, normalizeText, readJsonFile, writeJsonFile } from "./utils";

type OutputMode = "text" | "json";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  inputDir?: string;
  outputDir?: string;
  includeSelf: boolean;
  topQuotes: number;
  output: OutputMode;
}

interface ReviewRecord {
  rating: number;
  text: string;
  textKo?: string;
  date: string;
  user: string;
  source: "play" | "ios";
  reviewId?: string;
  storeReviewId?: string;
}

interface ReviewFilePayload {
  app: string;
  appName: string;
  reviews: ReviewRecord[];
  counts?: {
    play?: number;
    ios?: number;
    total?: number;
  };
}

interface TopicRule {
  id: string;
  labelKo: string;
  keywords: string[];
}

interface TopicCount {
  id: string;
  labelKo: string;
  count: number;
}

interface CompetitorMetrics {
  app: string;
  appName: string;
  fileName: string;
  totalReviews: number;
  avgRating: number;
  lowRatingCount: number;
  lowRatingShare: number;
  recent90Total: number;
  recent90Low: number;
  recent90LowShare: number;
  sourceCounts: {
    play: number;
    ios: number;
  };
  topNegativeTopics: TopicCount[];
  topPositiveTopics: TopicCount[];
  representativeLowReviews: Array<{
    rating: number;
    source: "play" | "ios";
    date: string;
    textKo: string;
    user: string;
  }>;
}

interface AnalysisJsonReport {
  ownerAppId: string;
  generatedAt: string;
  inputDir: string;
  filesAnalyzed: number;
  totalReviews: number;
  topicSummary: {
    negative: TopicCount[];
    positive: TopicCount[];
  };
  competitors: CompetitorMetrics[];
}

const TOPIC_RULES: TopicRule[] = [
  {
    id: "forecast_accuracy",
    labelKo: "예측 정확도",
    keywords: [
      "forecast",
      "prediction",
      "predict",
      "accur",
      "kp",
      "0% chance",
      "not accurate",
      "wrong",
      "예측",
      "정확",
      "오차",
      "틀림"
    ]
  },
  {
    id: "notification",
    labelKo: "알림/푸시",
    keywords: ["notification", "notifications", "alert", "alerts", "push", "알림", "푸시", "통지"]
  },
  {
    id: "bugs_performance",
    labelKo: "버그/성능",
    keywords: [
      "bug",
      "crash",
      "freez",
      "stuck",
      "loading",
      "slow",
      "lag",
      "won't update",
      "버그",
      "오류",
      "멈춤",
      "로딩",
      "느림"
    ]
  },
  {
    id: "ux_usability",
    labelKo: "사용성/UX",
    keywords: [
      "ui",
      "ux",
      "hard to",
      "difficult",
      "confusing",
      "scroll",
      "design",
      "navigation",
      "사용성",
      "불편",
      "복잡",
      "직관"
    ]
  },
  {
    id: "pricing_subscription",
    labelKo: "가격/구독/환불",
    keywords: [
      "subscription",
      "trial",
      "charged",
      "refund",
      "price",
      "pay",
      "billing",
      "구독",
      "결제",
      "환불",
      "가격",
      "유료"
    ]
  },
  {
    id: "ads",
    labelKo: "광고",
    keywords: ["ad", "ads", "advert", "광고"]
  },
  {
    id: "support_trust",
    labelKo: "고객지원/신뢰",
    keywords: [
      "support",
      "contact",
      "response",
      "scam",
      "privacy",
      "trust",
      "고객지원",
      "문의",
      "응답",
      "사기",
      "개인정보"
    ]
  }
];

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
    .scriptName("report:analyze")
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
      describe: "Input directory for review files. Defaults to data/{myAppId}/reviews-ko"
    })
    .option("output-dir", {
      type: "string",
      describe: "Output directory for report files. Defaults to data/{myAppId}/reports"
    })
    .option("include-self", {
      type: "boolean",
      default: false,
      describe: "Include files with *-self.json"
    })
    .option("top-quotes", {
      type: "number",
      default: 3,
      describe: "Number of representative low-rating quotes per competitor"
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

async function listJsonFiles(dirPath: string): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json") && !entry.name.startsWith("."))
    .map((entry) => path.resolve(dirPath, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

function pickReviewText(review: ReviewRecord): string {
  return normalizeText(review.textKo) || normalizeText(review.text);
}

function classifyTopics(text: string): string[] {
  const normalized = normalizeText(text).toLowerCase();
  if (!normalized) {
    return ["other"];
  }

  const matched = TOPIC_RULES.filter((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)));
  if (!matched.length) {
    return ["other"];
  }

  return matched.map((rule) => rule.id);
}

function topicLabel(topicId: string): string {
  if (topicId === "other") {
    return "기타";
  }

  return TOPIC_RULES.find((rule) => rule.id === topicId)?.labelKo ?? topicId;
}

function summarizeTopicCounts(counter: Map<string, number>, topN: number): TopicCount[] {
  return [...counter.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) {
        return b[1] - a[1];
      }
      return a[0].localeCompare(b[0]);
    })
    .slice(0, topN)
    .map(([id, count]) => ({
      id,
      labelKo: topicLabel(id),
      count
    }));
}

function formatPercent(input: number): string {
  return `${(input * 100).toFixed(1)}%`;
}

function formatRating(input: number): string {
  return Number.isFinite(input) ? input.toFixed(2) : "0.00";
}

function isRecentWithinDays(dateIso: string, days: number): boolean {
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  const now = Date.now();
  const threshold = now - days * 24 * 60 * 60 * 1000;
  return parsed.getTime() >= threshold;
}

function analyzeCompetitor(payload: ReviewFilePayload, fileName: string, topQuotes: number): CompetitorMetrics {
  const reviews = payload.reviews ?? [];
  const negativeTopicCounter = new Map<string, number>();
  const positiveTopicCounter = new Map<string, number>();

  let ratingSum = 0;
  let lowRatingCount = 0;
  let recent90Total = 0;
  let recent90Low = 0;

  const sourceCounts = {
    play: 0,
    ios: 0
  };

  for (const review of reviews) {
    ratingSum += review.rating;
    if (review.source === "play") {
      sourceCounts.play += 1;
    } else {
      sourceCounts.ios += 1;
    }

    const text = pickReviewText(review);
    const topics = classifyTopics(text);

    if (review.rating <= 2) {
      lowRatingCount += 1;
      for (const topic of topics) {
        negativeTopicCounter.set(topic, (negativeTopicCounter.get(topic) ?? 0) + 1);
      }
    }

    if (review.rating >= 4) {
      for (const topic of topics) {
        positiveTopicCounter.set(topic, (positiveTopicCounter.get(topic) ?? 0) + 1);
      }
    }

    if (isRecentWithinDays(review.date, 90)) {
      recent90Total += 1;
      if (review.rating <= 2) {
        recent90Low += 1;
      }
    }
  }

  const representativeLowReviews = reviews
    .filter((review) => review.rating <= 2 && normalizeText(pickReviewText(review)).length > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, Math.max(1, topQuotes))
    .map((review) => ({
      rating: review.rating,
      source: review.source,
      date: review.date,
      textKo: pickReviewText(review),
      user: normalizeText(review.user) || "anonymous"
    }));

  const totalReviews = reviews.length;

  return {
    app: payload.app,
    appName: normalizeText(payload.appName) || payload.app,
    fileName,
    totalReviews,
    avgRating: totalReviews > 0 ? ratingSum / totalReviews : 0,
    lowRatingCount,
    lowRatingShare: totalReviews > 0 ? lowRatingCount / totalReviews : 0,
    recent90Total,
    recent90Low,
    recent90LowShare: recent90Total > 0 ? recent90Low / recent90Total : 0,
    sourceCounts,
    topNegativeTopics: summarizeTopicCounts(negativeTopicCounter, 5),
    topPositiveTopics: summarizeTopicCounts(positiveTopicCounter, 5),
    representativeLowReviews
  };
}

function buildMarkdownReport(report: AnalysisJsonReport): string {
  const lines: string[] = [];

  lines.push("# 경쟁앱 리뷰 분석 리포트");
  lines.push("");
  lines.push(`- 생성 시각: ${report.generatedAt}`);
  lines.push(`- ownerAppId: ${report.ownerAppId}`);
  lines.push(`- 분석 파일 수: ${report.filesAnalyzed}`);
  lines.push(`- 총 리뷰 수: ${report.totalReviews}`);
  lines.push("");

  const highestLowShare = [...report.competitors]
    .filter((item) => item.totalReviews > 0)
    .sort((a, b) => b.lowRatingShare - a.lowRatingShare)[0];

  const bestAvgRating = [...report.competitors]
    .filter((item) => item.totalReviews > 0)
    .sort((a, b) => b.avgRating - a.avgRating)[0];

  lines.push("## 핵심 인사이트");
  if (highestLowShare) {
    lines.push(
      `1. 저평점 비율이 가장 높은 앱은 **${highestLowShare.appName}**(${formatPercent(highestLowShare.lowRatingShare)})입니다.`
    );
  }
  if (bestAvgRating) {
    lines.push(`2. 평균 평점이 가장 높은 앱은 **${bestAvgRating.appName}**(${formatRating(bestAvgRating.avgRating)})입니다.`);
  }

  const topNeg = report.topicSummary.negative.slice(0, 3);
  if (topNeg.length > 0) {
    lines.push(
      `3. 전체 불만 상위 토픽은 ${topNeg.map((item) => `${item.labelKo}(${item.count})`).join(", ")} 입니다.`
    );
  }
  lines.push("");

  lines.push("## 전체 토픽 요약");
  lines.push("");
  lines.push("### 부정 토픽 Top 10");
  for (const topic of report.topicSummary.negative) {
    lines.push(`- ${topic.labelKo}: ${topic.count}`);
  }
  lines.push("");

  lines.push("### 긍정 토픽 Top 10");
  for (const topic of report.topicSummary.positive) {
    lines.push(`- ${topic.labelKo}: ${topic.count}`);
  }
  lines.push("");

  lines.push("## 경쟁앱 상세");
  lines.push("");

  for (const competitor of report.competitors) {
    lines.push(`### ${competitor.appName} (${competitor.app})`);
    lines.push(`- 리뷰 수: ${competitor.totalReviews}`);
    lines.push(`- 평균 평점: ${formatRating(competitor.avgRating)}`);
    lines.push(`- 저평점(1~2점): ${competitor.lowRatingCount} (${formatPercent(competitor.lowRatingShare)})`);
    lines.push(
      `- 최근 90일 저평점 비율: ${competitor.recent90Low}/${competitor.recent90Total} (${formatPercent(competitor.recent90LowShare)})`
    );
    lines.push(`- 플랫폼 분포: play ${competitor.sourceCounts.play}, ios ${competitor.sourceCounts.ios}`);

    const negative = competitor.topNegativeTopics.length
      ? competitor.topNegativeTopics.map((topic) => `${topic.labelKo}(${topic.count})`).join(", ")
      : "없음";

    const positive = competitor.topPositiveTopics.length
      ? competitor.topPositiveTopics.map((topic) => `${topic.labelKo}(${topic.count})`).join(", ")
      : "없음";

    lines.push(`- 주요 불만 토픽: ${negative}`);
    lines.push(`- 주요 강점 토픽: ${positive}`);

    if (competitor.representativeLowReviews.length > 0) {
      lines.push("- 대표 불만 리뷰:");
      for (const quote of competitor.representativeLowReviews) {
        lines.push(
          `  - [${quote.source}/${quote.rating}점/${quote.date}] ${quote.textKo.slice(0, 220)}${
            quote.textKo.length > 220 ? "..." : ""
          }`
        );
      }
    }

    lines.push("");
  }

  return lines.join("\n");
}

function printTextSummary(report: AnalysisJsonReport, markdownPath: string, jsonPath: string): void {
  console.log("\nAnalysis summary");
  console.log(`- ownerAppId: ${report.ownerAppId}`);
  console.log(`- files analyzed: ${report.filesAnalyzed}`);
  console.log(`- total reviews: ${report.totalReviews}`);
  console.log(`- markdown report: ${markdownPath}`);
  console.log(`- json report: ${jsonPath}`);
}

async function main(): Promise<void> {
  const argv = await parseArgs();
  const owner = await resolveOwnerApp(String(argv.myApp), argv.registeredAppsPath);
  const ownerAppId = owner.ownerAppId;
  const logger = createLogger(argv.output);

  const preferredInputDir = resolvePathOrDefault(ownerAppId, argv.inputDir, "reviews-ko");
  let inputDir = preferredInputDir;

  try {
    await fs.access(preferredInputDir);
  } catch {
    if (normalizeText(argv.inputDir)) {
      throw new Error(`Input directory not found: ${preferredInputDir}`);
    }

    inputDir = resolvePathOrDefault(ownerAppId, undefined, "reviews");
    logger.warn(`reviews-ko not found. fallback to raw reviews: ${inputDir}`);
  }

  const outputDir = resolvePathOrDefault(ownerAppId, argv.outputDir, "reports");
  await ensureDir(outputDir);

  const files = await listJsonFiles(inputDir);
  const filteredFiles = files.filter((filePath) => {
    if (argv.includeSelf) {
      return true;
    }
    return !path.basename(filePath).includes("-self");
  });

  if (!filteredFiles.length) {
    throw new Error(`No review files to analyze in ${inputDir}`);
  }

  const competitors: CompetitorMetrics[] = [];
  const negativeTopicCounter = new Map<string, number>();
  const positiveTopicCounter = new Map<string, number>();
  let totalReviews = 0;

  for (const filePath of filteredFiles) {
    const payload = await readJsonFile<ReviewFilePayload>(filePath);
    if (!normalizeText(payload.app) || !Array.isArray(payload.reviews)) {
      logger.warn(`skipped invalid payload: ${path.basename(filePath)}`);
      continue;
    }

    const metrics = analyzeCompetitor(payload, path.basename(filePath), argv.topQuotes);

    totalReviews += metrics.totalReviews;

    for (const topic of metrics.topNegativeTopics) {
      negativeTopicCounter.set(topic.id, (negativeTopicCounter.get(topic.id) ?? 0) + topic.count);
    }

    for (const topic of metrics.topPositiveTopics) {
      positiveTopicCounter.set(topic.id, (positiveTopicCounter.get(topic.id) ?? 0) + topic.count);
    }

    competitors.push(metrics);
  }

  competitors.sort((a, b) => b.totalReviews - a.totalReviews);

  const jsonReport: AnalysisJsonReport = {
    ownerAppId,
    generatedAt: new Date().toISOString(),
    inputDir,
    filesAnalyzed: filteredFiles.length,
    totalReviews,
    topicSummary: {
      negative: summarizeTopicCounts(negativeTopicCounter, 10),
      positive: summarizeTopicCounts(positiveTopicCounter, 10)
    },
    competitors
  };

  const markdownReport = buildMarkdownReport(jsonReport);
  const markdownPath = path.resolve(outputDir, "competitor-report.ko.md");
  const jsonPath = path.resolve(outputDir, "competitor-report.ko.json");

  await fs.writeFile(markdownPath, markdownReport, "utf8");
  await writeJsonFile(jsonPath, jsonReport);

  if (argv.output === "json") {
    console.log(
      JSON.stringify(
        {
          ok: true,
          ownerAppId,
          filesAnalyzed: filteredFiles.length,
          totalReviews,
          markdownPath,
          jsonPath
        },
        null,
        2
      )
    );
    return;
  }

  printTextSummary(jsonReport, markdownPath, jsonPath);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
