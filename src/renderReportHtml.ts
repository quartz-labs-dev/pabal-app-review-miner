#!/usr/bin/env node

import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import { ensureReviewId, normalizeText, safeFileName, UnifiedReview } from "./utils";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  input?: string;
  output?: string;
  all: boolean;
}

type CategoryKey = "satisfaction" | "dissatisfaction" | "requests";
type ReviewTag = "heart" | "satisfaction" | "dissatisfaction" | "requests";
type Priority = "must" | "should" | "could";
type Impact = "high" | "medium" | "low";
type Effort = "high" | "medium" | "low";

interface QuoteItem {
  reviewId: string;
  evidenceKey?: string;
  meta: string;
  kr: string;
  org: string;
  tags?: ReviewTag[];
}

interface AppSection {
  title: string;
  reviewCount?: string;
  categories: Record<CategoryKey, QuoteItem[]>;
}

interface ThemeDefinition {
  id: string;
  title: string;
  keywords: string[];
  impact: Impact;
  effort: Effort;
  action: string;
}

interface BacklogItem {
  priority: Priority;
  title: string;
  impact: Impact;
  effort: Effort;
  action: string;
  evidenceCount: number;
  evidenceReviewIds: string[];
  examples: QuoteItem[];
}

interface AppBacklog {
  appTitle: string;
  reviewCount: string;
  items: BacklogItem[];
}

interface UnifiedBacklogItem {
  priority: Priority;
  title: string;
  impact: Impact;
  effort: Effort;
  action: string;
  evidenceCount: number;
  examples: QuoteItem[];
  appNames: string[];
}

interface StoreLink {
  label: "App Store" | "Google Play";
  href: string;
}

interface AppNoteApp {
  appKey: string;
  title: string;
  sourceToken?: string;
  links: StoreLink[];
}

interface AppReviewPoolItem {
  reviewId: string;
  source: "play" | "ios";
  rating: number;
  date: string;
  meta: string;
  kr: string;
  org: string;
}

interface AppReviewPool {
  sourceToken: string;
  displayName: string;
  reviews: AppReviewPoolItem[];
}

interface ReviewPools {
  byToken: Map<string, AppReviewPool>;
  byDisplayName: Map<string, AppReviewPool[]>;
}

const THEMES: ThemeDefinition[] = [
  {
    id: "reliability_performance",
    title: "핵심 플로우 안정화 (로딩/크래시/동기화)",
    keywords: [
      "crash",
      "freeze",
      "stuck",
      "loading",
      "buffer",
      "blank screen",
      "sync",
      "cannot login",
      "bug",
      "오류",
      "멈춤",
      "로딩",
      "버그",
      "동기화",
      "로그인",
      "작동하지"
    ],
    impact: "high",
    effort: "high",
    action: "로그인/재생/알림/지도 진입 등 핵심 사용자 여정의 안정성 이슈를 우선 해결"
  },
  {
    id: "multi_location_planning",
    title: "다중 위치/여행 계획 지원",
    keywords: [
      "choose location",
      "select location",
      "other location",
      "remote location",
      "travel",
      "map",
      "location",
      "different location",
      "위치 선택",
      "다른 위치",
      "여행",
      "지도",
      "원격 위치"
    ],
    impact: "high",
    effort: "medium",
    action: "현재 위치 외에 저장 위치/원격 위치를 등록해 비교·계획 가능한 UX 제공"
  },
  {
    id: "alert_relevance",
    title: "알림 관련성 개선 (주간/구름/현지 조건 필터)",
    keywords: [
      "daylight",
      "dawn",
      "dusk",
      "cloud",
      "overcast",
      "solar noon",
      "mute",
      "threshold",
      "일광",
      "낮",
      "새벽",
      "황혼",
      "구름",
      "흐림",
      "음소거",
      "임계"
    ],
    impact: "high",
    effort: "medium",
    action: "지역 일출/일몰·구름량·사용자 임계값을 반영한 알림 정책으로 노이즈를 축소"
  },
  {
    id: "advanced_alert_logic",
    title: "고급 알림 규칙 (복합 조건 트리거)",
    keywords: [
      "bz",
      "bt",
      "solar wind",
      "speed",
      "density",
      "combination",
      "criter",
      "태양풍",
      "속도",
      "밀도",
      "조합",
      "조건"
    ],
    impact: "high",
    effort: "high",
    action: "단일 기준이 아닌 복합 조건(Bz+속도 등) 기반의 고급 알림 룰 제공"
  },
  {
    id: "forecast_transparency",
    title: "예보 신뢰성/출처 투명화",
    keywords: [
      "model",
      "source",
      "noaa",
      "ovation",
      "aurorawatch",
      "compare",
      "accuracy",
      "fake kp",
      "not accurate",
      "모델",
      "출처",
      "정확",
      "비교"
    ],
    impact: "high",
    effort: "medium",
    action: "예보 모델/출처를 명시하고 다중 모델 비교 또는 보정 가이드를 제공"
  },
  {
    id: "notification_controls",
    title: "알림 제어권 강화",
    keywords: [
      "notification",
      "alert",
      "push",
      "alarm",
      "알림",
      "푸시",
      "알람",
      "notifications"
    ],
    impact: "medium",
    effort: "medium",
    action: "알림 빈도/시간대/조건/채널을 세분화해 개인화된 제어 옵션 제공"
  },
  {
    id: "widget_watch_screen",
    title: "위젯/워치/대화면 최적화",
    keywords: [
      "widget",
      "apple watch",
      "watch",
      "ipad",
      "landscape",
      "tablet",
      "위젯",
      "워치",
      "아이패드",
      "가로",
      "큰 화면"
    ],
    impact: "medium",
    effort: "medium",
    action: "위젯, Apple Watch, 태블릿/가로모드 등 기기별 사용 맥락 최적화"
  },
  {
    id: "pricing_paywall",
    title: "가격/유료화 명확성 개선",
    keywords: [
      "price",
      "paid",
      "subscription",
      "trial",
      "refund",
      "paywall",
      "pricing",
      "가격",
      "유료",
      "구독",
      "환불"
    ],
    impact: "medium",
    effort: "low",
    action: "유료 기능/가격/환불/체험 조건을 초반 화면에서 명확하게 고지"
  },
  {
    id: "offline_playback",
    title: "오프라인 다운로드/재생 품질",
    keywords: [
      "download",
      "offline",
      "stream",
      "airplay",
      "cast",
      "fullscreen",
      "chapter",
      "video player",
      "버퍼",
      "다운로드",
      "오프라인",
      "전체 화면",
      "챕터",
      "재생"
    ],
    impact: "high",
    effort: "high",
    action: "다운로드 큐, 재개, 챕터 탐색, 캐스팅/전체화면 안정성 중심으로 미디어 스택 개선"
  },
  {
    id: "timezone_localization",
    title: "시간대/지역화 정확성",
    keywords: [
      "timezone",
      "time zone",
      "gmt",
      "local time",
      "time data",
      "시간대",
      "현지 시간",
      "지역화"
    ],
    impact: "medium",
    effort: "low",
    action: "시간대 표기 및 계산 로직을 명확화하고 사용자 선택 옵션 제공"
  }
];

const PRIORITY_BOOST_THEME_IDS = new Set([
  "reliability_performance",
  "offline_playback",
  "alert_relevance",
  "multi_location_planning"
]);

const REVIEW_COUNT_PREFIXES = ["- 전체 리뷰 수:", "- Total review count:"];
const BACKLOG_CATEGORY_ORDER: CategoryKey[] = ["dissatisfaction", "requests", "satisfaction"];
const REPORTS_DIR_NAME = "reports";
const DEFAULT_REPORT_MARKDOWN_FILE = "competitor-raw-actionable.ko.md";
const DEFAULT_REPORT_HTML_FILE = "competitor-raw-actionable.ko.html";

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function parseReviewCount(line: string): string | undefined {
  for (const prefix of REVIEW_COUNT_PREFIXES) {
    if (line.startsWith(prefix)) {
      return normalizeText(line.slice(prefix.length));
    }
  }
  return undefined;
}

function defaultTagsForCategory(category: CategoryKey): ReviewTag[] {
  if (category === "satisfaction") {
    return ["satisfaction"];
  }
  if (category === "dissatisfaction") {
    return ["dissatisfaction"];
  }
  return ["requests"];
}

function normalizeReviewTags(tags: unknown): ReviewTag[] {
  const source = Array.isArray(tags) ? tags : [];
  const seen = new Set<ReviewTag>();
  const ordered: ReviewTag[] = [];

  for (const tag of source) {
    const normalized = normalizeText(String(tag ?? "")).toLowerCase();
    if (
      normalized !== "heart" &&
      normalized !== "satisfaction" &&
      normalized !== "dissatisfaction" &&
      normalized !== "requests"
    ) {
      continue;
    }

    const typed = normalized as ReviewTag;
    if (seen.has(typed)) {
      continue;
    }

    seen.add(typed);
    ordered.push(typed);
  }

  return ordered;
}

function resolveQuoteTags(quote: QuoteItem, fallbackCategory: CategoryKey): ReviewTag[] {
  const normalized = normalizeReviewTags(quote.tags);
  if (normalized.length > 0) {
    return normalized;
  }
  return defaultTagsForCategory(fallbackCategory);
}

function hashToken(input: string): string {
  return createHash("sha1").update(input).digest("hex").slice(0, 20);
}

function createQuoteReviewId(
  appTitle: string,
  quote: Pick<QuoteItem, "meta" | "kr" | "org">
): string {
  const fingerprint = [
    normalizeText(appTitle).toLowerCase(),
    normalizeText(quote.meta).toLowerCase(),
    normalizeText(quote.kr).toLowerCase(),
    normalizeText(quote.org).toLowerCase()
  ].join("::");

  return `rq_${hashToken(fingerprint)}`;
}

function parseQuoteMeta(meta: string): {
  platform?: string;
  rating?: string;
  date?: string;
  raw: string;
} {
  const raw = normalizeText(meta);
  if (!raw) {
    return { raw: "" };
  }

  const stripped = raw.replace(/^\(/, "").replace(/\)$/, "");
  const pieces = stripped.split(",").map((item) => normalizeText(item)).filter(Boolean);
  const first = pieces[0] ?? "";
  const [platformRaw, ratingRaw] = first.split("/").map((item) => normalizeText(item));
  const platform = platformRaw || undefined;
  const rating = ratingRaw || undefined;
  const date = normalizeText(pieces.slice(1).join(", ")) || undefined;

  if (!platform && !rating && !date) {
    return { raw };
  }

  return {
    platform,
    rating,
    date,
    raw
  };
}

function resolveDefaultInput(ownerAppId: string): string {
  return path.resolve(process.cwd(), "data", ownerAppId, REPORTS_DIR_NAME, DEFAULT_REPORT_MARKDOWN_FILE);
}

function resolveDefaultOutput(ownerAppId: string): string {
  return path.resolve(process.cwd(), "data", ownerAppId, REPORTS_DIR_NAME, DEFAULT_REPORT_HTML_FILE);
}

async function parseArgs(): Promise<CliArgs> {
  const parsed = await yargs(hideBin(process.argv))
    .scriptName("report:render-html")
    .usage("$0 (--my-app <owner> | --all) [options]")
    .option("my-app", {
      type: "string",
      describe: "Owner app key used to resolve app slug"
    })
    .option("all", {
      type: "boolean",
      default: false,
      describe:
        "Render HTML for all apps that have data/{appId}/reports/competitor-raw-actionable.ko.md"
    })
    .option("registered-apps-path", {
      type: "string",
      describe: "Path to registered-apps.json (default: ~/.config/pabal-mcp/registered-apps.json)"
    })
    .option("input", {
      type: "string",
      describe: "Input markdown report path (default: data/{myAppId}/reports/competitor-raw-actionable.ko.md)"
    })
    .option("output", {
      type: "string",
      describe: "Output html path (default: data/{myAppId}/reports/competitor-raw-actionable.ko.html)"
    })
    .help()
    .strict()
    .parse();

  return parsed as unknown as CliArgs;
}

async function findOwnerAppIdsForBatchRender(): Promise<string[]> {
  const dataRoot = path.resolve(process.cwd(), "data");
  const entries = await fs.readdir(dataRoot, { withFileTypes: true }).catch(() => []);
  const appIds: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const appId = normalizeText(entry.name);
    if (!appId) {
      continue;
    }

    const markdownPath = path.resolve(dataRoot, appId, REPORTS_DIR_NAME, DEFAULT_REPORT_MARKDOWN_FILE);
    try {
      const stat = await fs.stat(markdownPath);
      if (stat.isFile()) {
        appIds.push(appId);
      }
    } catch {
      // Skip apps without a default markdown report.
    }
  }

  return appIds.sort((a, b) => a.localeCompare(b));
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toInlineJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function createAppStoreUrl(appId: string): string {
  return `https://apps.apple.com/app/id${encodeURIComponent(appId)}`;
}

function createPlayStoreUrl(packageName: string): string {
  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(packageName)}`;
}

function parseAppTitle(rawTitle: string): { displayName: string; sourceToken?: string } {
  const trimmed = normalizeText(rawTitle);
  const match = trimmed.match(/^(.*)\(([^()]+)\)\s*$/);

  if (!match) {
    return { displayName: trimmed };
  }

  return {
    displayName: normalizeText(match[1]),
    sourceToken: normalizeText(match[2])
  };
}

function hasHangul(input: string): boolean {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(input);
}

function resolveReportLanguage(parsedTitle: string): "ko" | "en" {
  return hasHangul(normalizeText(parsedTitle)) ? "ko" : "en";
}

function resolveReportTitle(ownerAppId: string, parsedTitle: string): string {
  const title = normalizeText(parsedTitle);
  const base = ownerAppId || "app";
  if (resolveReportLanguage(title) === "ko") {
    return `${base} 리뷰 리포트`;
  }
  return `${base} Review Report`;
}

async function resolveOwnerAppIconMetaHref(ownerAppId: string): Promise<string | undefined> {
  if (!ownerAppId) {
    return undefined;
  }

  const iconPath = path.resolve(process.cwd(), "data", ownerAppId, "icon.png");
  try {
    const stat = await fs.stat(iconPath);
    if (!stat.isFile()) {
      return undefined;
    }
  } catch {
    return undefined;
  }

  return `/assets/app-icons/${encodeURIComponent(ownerAppId)}.png`;
}

function resolveAppStateKey(rawTitle: string, pool?: AppReviewPool): string {
  const parsed = parseAppTitle(rawTitle);
  const keySource = normalizeText(pool?.sourceToken) || normalizeText(parsed.sourceToken) || normalizeText(parsed.displayName);
  return safeFileName(keySource || "app");
}

function normalizeMatchText(input: string | undefined): string {
  return normalizeText(input).toLowerCase();
}

function normalizeReviewSource(input: unknown): "play" | "ios" | undefined {
  const normalized = normalizeText(String(input ?? "")).toLowerCase();
  if (normalized === "play") {
    return "play";
  }
  if (normalized === "ios") {
    return "ios";
  }
  return undefined;
}

function parseRatingNumber(input: string | undefined): number | undefined {
  const normalized = normalizeText(input);
  if (!normalized) {
    return undefined;
  }

  const digits = normalized.replace(/[^0-9.]+/g, "");
  if (!digits) {
    return undefined;
  }

  const value = Number(digits);
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

function formatReadableDate(input: string | undefined): string {
  const normalized = normalizeText(input);
  if (!normalized) {
    return "";
  }

  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    return normalized;
  }

  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function formatRatingStars(input: string | undefined): { stars: string; label: string } | undefined {
  const rating = parseRatingNumber(input);
  if (typeof rating !== "number") {
    return undefined;
  }

  const clamped = Math.max(0, Math.min(5, Math.round(rating)));
  return {
    stars: `${"★".repeat(clamped)}${"☆".repeat(5 - clamped)}`,
    label: `${clamped}점`
  };
}

async function loadReviewPools(ownerAppId: string): Promise<ReviewPools> {
  const primaryDir = path.resolve(process.cwd(), "data", ownerAppId, "reviews-ko");
  const fallbackDir = path.resolve(process.cwd(), "data", ownerAppId, "reviews");

  let sourceDir = fallbackDir;
  try {
    const stat = await fs.stat(primaryDir);
    if (stat.isDirectory()) {
      sourceDir = primaryDir;
    }
  } catch {
    sourceDir = fallbackDir;
  }

  const entries = await fs.readdir(sourceDir, { withFileTypes: true }).catch(() => []);
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => path.resolve(sourceDir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  const byToken = new Map<string, AppReviewPool>();
  const byDisplayName = new Map<string, AppReviewPool[]>();

  for (const filePath of jsonFiles) {
    try {
      const raw = await fs.readFile(filePath, "utf8");
      const payload = JSON.parse(raw) as Record<string, unknown>;
      const reviewsRaw = Array.isArray(payload.reviews) ? payload.reviews : [];
      const sourceToken = normalizeText(String(payload.app ?? path.basename(filePath, ".json")));
      if (!sourceToken) {
        continue;
      }

      const displayName = normalizeText(String(payload.appName ?? sourceToken));
      const seenReviewIds = new Set<string>();
      const reviews: AppReviewPoolItem[] = [];

      for (const reviewRaw of reviewsRaw) {
        if (!reviewRaw || typeof reviewRaw !== "object") {
          continue;
        }

        const row = reviewRaw as Record<string, unknown>;
        const source = normalizeReviewSource(row.source);
        if (!source) {
          continue;
        }

        const unifiedReview = ensureReviewId({
          source,
          rating: Number(row.rating ?? 0),
          text: normalizeText(String(row.text ?? "")),
          date: normalizeText(String(row.date ?? "")),
          user: normalizeText(String(row.user ?? "anonymous")) || "anonymous",
          reviewId: normalizeText(String(row.reviewId ?? "")) || undefined,
          storeReviewId: normalizeText(String(row.storeReviewId ?? "")) || undefined
        } as UnifiedReview);

        const reviewId = normalizeText(unifiedReview.reviewId);
        if (!reviewId || seenReviewIds.has(reviewId)) {
          continue;
        }
        seenReviewIds.add(reviewId);

        const rating = Number(unifiedReview.rating ?? 0);
        const date = normalizeText(unifiedReview.date);
        const org = normalizeText(unifiedReview.text);
        const kr = normalizeText(String((row as Record<string, unknown>).textKo ?? "")) || org;

        reviews.push({
          reviewId,
          source,
          rating,
          date,
          meta: `${source}/${rating}점, ${date}`,
          kr,
          org
        });
      }

      reviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const pool: AppReviewPool = {
        sourceToken,
        displayName,
        reviews
      };

      byToken.set(sourceToken, pool);

      const nameKey = normalizeMatchText(displayName);
      const list = byDisplayName.get(nameKey) ?? [];
      list.push(pool);
      byDisplayName.set(nameKey, list);
    } catch {
      // ignore malformed review files in pool loading
    }
  }

  return {
    byToken,
    byDisplayName
  };
}

function resolvePoolForApp(appTitle: string, pools: ReviewPools): AppReviewPool | undefined {
  const parsed = parseAppTitle(appTitle);
  if (parsed.sourceToken && pools.byToken.has(parsed.sourceToken)) {
    return pools.byToken.get(parsed.sourceToken);
  }

  const candidates = pools.byDisplayName.get(normalizeMatchText(parsed.displayName)) ?? [];
  if (candidates.length === 1) {
    return candidates[0];
  }

  return undefined;
}

function findPoolReviewIdForQuote(item: QuoteItem, pool?: AppReviewPool): string | undefined {
  if (!pool || pool.reviews.length === 0) {
    return undefined;
  }

  const parsedMeta = parseQuoteMeta(item.meta);
  const source = normalizeReviewSource(parsedMeta.platform);
  const rating = parseRatingNumber(parsedMeta.rating);
  const date = normalizeText(parsedMeta.date);
  const kr = normalizeMatchText(item.kr);
  const org = normalizeMatchText(item.org);

  const candidates = pool.reviews.filter((review) => {
    if (source && review.source !== source) {
      return false;
    }
    if (typeof rating === "number" && review.rating !== rating) {
      return false;
    }
    if (date && review.date !== date) {
      return false;
    }
    return true;
  });

  const exact = candidates.find(
    (review) => normalizeMatchText(review.kr) === kr && normalizeMatchText(review.org) === org
  );
  if (exact) {
    return exact.reviewId;
  }

  const krMatch = candidates.find((review) => normalizeMatchText(review.kr) === kr);
  if (krMatch) {
    return krMatch.reviewId;
  }

  const orgMatch = candidates.find((review) => normalizeMatchText(review.org) === org);
  if (orgMatch) {
    return orgMatch.reviewId;
  }

  return undefined;
}

function extractStoreLinks(sourceToken?: string): StoreLink[] {
  if (!sourceToken) {
    return [];
  }

  const links: StoreLink[] = [];
  const seen = new Set<string>();
  const add = (label: StoreLink["label"], href: string) => {
    if (seen.has(href)) {
      return;
    }
    seen.add(href);
    links.push({ label, href });
  };

  for (const match of sourceToken.matchAll(/(?:^|__)ios-([0-9]+)/g)) {
    add("App Store", createAppStoreUrl(match[1]));
  }

  for (const match of sourceToken.matchAll(/(?:^|__)play-([a-z0-9._]+)/gi)) {
    add("Google Play", createPlayStoreUrl(match[1]));
  }

  return links;
}

function renderAppHeading(rawTitle: string): string {
  const parsed = parseAppTitle(rawTitle);
  const links = extractStoreLinks(parsed.sourceToken);
  const tokenHtml = parsed.sourceToken
    ? `<span class=\"app-token\">(${escapeHtml(parsed.sourceToken)})</span>`
    : "";

  const linksHtml = links.length
    ? `<span class=\"store-links\">${links
        .map(
          (link) =>
            `<a class=\"store-link\" href=\"${escapeHtml(link.href)}\" target=\"_blank\" rel=\"noopener noreferrer\" onclick=\"event.stopPropagation()\">${escapeHtml(link.label)}</a>`
        )
        .join("")}</span>`
    : "";

  return `<span class=\"app-heading\"><span class=\"app-title\">${escapeHtml(parsed.displayName)}</span>${tokenHtml}${linksHtml}</span>`;
}

function mapCategory(heading: string): CategoryKey | undefined {
  const normalized = heading.toLowerCase();
  if (includesAny(heading, ["불만"]) || includesAny(normalized, ["dissatisfaction"])) {
    return "dissatisfaction";
  }
  if (includesAny(heading, ["만족"]) || includesAny(normalized, ["satisfaction"])) {
    return "satisfaction";
  }
  if (includesAny(heading, ["요청", "개선"]) || includesAny(normalized, ["request", "improvement"])) {
    return "requests";
  }
  return undefined;
}

function parseMarkdown(input: string): { title: string; metadata: string[]; apps: AppSection[] } {
  const lines = input.split(/\r?\n/);
  let title = "리뷰 리포트";
  const metadata: string[] = [];
  const apps: AppSection[] = [];

  let currentApp: AppSection | undefined;
  let currentCategory: CategoryKey | undefined;
  let currentQuote: Omit<QuoteItem, "reviewId"> | undefined;

  function flushQuote() {
    if (!currentApp || !currentCategory || !currentQuote) {
      return;
    }

    const kr = normalizeText(currentQuote.kr);
    const org = normalizeText(currentQuote.org);
    if (!kr && !org) {
      currentQuote = undefined;
      return;
    }

    currentApp.categories[currentCategory].push({
      reviewId: createQuoteReviewId(currentApp.title, {
        meta: normalizeText(currentQuote.meta),
        kr,
        org
      }),
      meta: normalizeText(currentQuote.meta),
      kr,
      org,
      tags: defaultTagsForCategory(currentCategory)
    });

    currentQuote = undefined;
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("# ")) {
      title = normalizeText(line.slice(2));
      continue;
    }

    if (line.startsWith("## ")) {
      flushQuote();
      currentCategory = undefined;
      currentQuote = undefined;

      currentApp = {
        title: normalizeText(line.slice(3)),
        categories: {
          satisfaction: [],
          dissatisfaction: [],
          requests: []
        }
      };

      apps.push(currentApp);
      continue;
    }

    if (line.startsWith("### ")) {
      flushQuote();
      currentQuote = undefined;
      currentCategory = mapCategory(normalizeText(line.slice(4)));
      continue;
    }

    if (!currentApp) {
      if (line.startsWith("- ")) {
        metadata.push(normalizeText(line.slice(2)));
      }
      continue;
    }

    const reviewCount = parseReviewCount(line);
    if (reviewCount !== undefined) {
      currentApp.reviewCount = reviewCount;
      continue;
    }

    if (line.startsWith("- (") && line.endsWith(")")) {
      flushQuote();
      currentQuote = {
        meta: normalizeText(line.slice(2)),
        kr: "",
        org: ""
      };
      continue;
    }

    if (line.includes("- KR:")) {
      if (currentQuote) {
        currentQuote.kr = normalizeText(line.split("- KR:")[1] ?? "");
      }
      continue;
    }

    if (line.includes("- ORG:")) {
      if (currentQuote) {
        currentQuote.org = normalizeText(line.split("- ORG:")[1] ?? "");
      }
      continue;
    }
  }

  flushQuote();

  return { title, metadata, apps };
}

function renderCategoryTitle(key: CategoryKey): string {
  if (key === "satisfaction") {
    return "#만족";
  }
  if (key === "dissatisfaction") {
    return "#불만족";
  }
  return "#요청기능";
}

function priorityOrder(priority: Priority): number {
  if (priority === "must") {
    return 0;
  }
  if (priority === "should") {
    return 1;
  }
  return 2;
}

function calculatePriority(themeId: string, reqCount: number, negCount: number, posCount: number): Priority {
  const score = reqCount * 3 + negCount * 2 + posCount;

  if (score >= 10) {
    return "must";
  }

  if (PRIORITY_BOOST_THEME_IDS.has(themeId) && score >= 6) {
    return "must";
  }

  if (score >= 5) {
    return "should";
  }

  return "could";
}

function buildBacklog(apps: AppSection[], reviewPools: ReviewPools): AppBacklog[] {
  return apps.map((app) => {
    const appPool = resolvePoolForApp(app.title, reviewPools);
    const buckets = new Map<
      string,
      {
        theme: ThemeDefinition;
        reqCount: number;
        negCount: number;
        posCount: number;
        evidenceReviewIds: Set<string>;
        evidenceQuoteById: Map<string, QuoteItem>;
        examples: QuoteItem[];
      }
    >();

    const appScope = normalizeText(app.title).toLowerCase();
    for (const categoryKey of BACKLOG_CATEGORY_ORDER) {
      for (const quote of app.categories[categoryKey]) {
        const text = `${quote.kr} ${quote.org} ${quote.meta}`.toLowerCase();

        for (const theme of THEMES) {
          const hit = theme.keywords.some((keyword) => text.includes(keyword));
          if (!hit) {
            continue;
          }

          const bucket =
            buckets.get(theme.id) ?? {
              theme,
              reqCount: 0,
              negCount: 0,
              posCount: 0,
              evidenceReviewIds: new Set<string>(),
              evidenceQuoteById: new Map<string, QuoteItem>(),
              examples: []
            };

          const baseReviewId =
            normalizeText(findPoolReviewIdForQuote(quote, appPool)) ||
            normalizeText(quote.reviewId) ||
            createQuoteReviewId(app.title, {
              meta: quote.meta,
              kr: quote.kr,
              org: quote.org
            });
          const scopedReviewId = `${appScope}::${baseReviewId}`.toLowerCase();
          if (bucket.evidenceReviewIds.has(scopedReviewId)) {
            continue;
          }
          bucket.evidenceReviewIds.add(scopedReviewId);

          const quoteTags = resolveQuoteTags(quote, categoryKey);
          if (quoteTags.includes("requests")) {
            bucket.reqCount += 1;
          }
          if (quoteTags.includes("dissatisfaction")) {
            bucket.negCount += 1;
          }
          if (quoteTags.includes("satisfaction")) {
            bucket.posCount += 1;
          }

          bucket.examples.push({
            ...quote,
            reviewId: baseReviewId,
            evidenceKey: scopedReviewId
          });
          bucket.evidenceQuoteById.set(scopedReviewId, {
            ...quote,
            reviewId: baseReviewId,
            evidenceKey: scopedReviewId
          });

          buckets.set(theme.id, bucket);
        }
      }
    }

    const items: BacklogItem[] = [...buckets.values()]
      .map((bucket) => {
        const evidenceReviewIds = [...bucket.evidenceReviewIds];
        const evidenceCount = evidenceReviewIds.length;
        const examples = evidenceReviewIds
          .map((reviewId) => bucket.evidenceQuoteById.get(reviewId))
          .filter((quote): quote is QuoteItem => Boolean(quote));
        const priority = calculatePriority(
          bucket.theme.id,
          bucket.reqCount,
          bucket.negCount,
          bucket.posCount
        );

        return {
          priority,
          title: bucket.theme.title,
          impact: bucket.theme.impact,
          effort: bucket.theme.effort,
          action: bucket.theme.action,
          evidenceCount,
          evidenceReviewIds,
          examples
        };
      })
      .sort((a, b) => {
        if (priorityOrder(a.priority) !== priorityOrder(b.priority)) {
          return priorityOrder(a.priority) - priorityOrder(b.priority);
        }
        return b.evidenceCount - a.evidenceCount;
      });

    return {
      appTitle: app.title,
      reviewCount: app.reviewCount ?? "-",
      items
    };
  });
}

function renderPriorityBadge(priority: Priority): string {
  const label = priority.toUpperCase();
  return `<span class=\"badge badge-${priority}\">${label}</span>`;
}

function renderLevel(level: Impact | Effort): string {
  if (level === "high") {
    return "High";
  }
  if (level === "medium") {
    return "Medium";
  }
  return "Low";
}

function renderMetaChip(className: string, content: string | undefined, title?: string): string {
  const normalized = normalizeText(content);
  if (!normalized) {
    return "";
  }

  const titleAttr = normalizeText(title) ? ` title="${escapeHtml(title ?? "")}"` : "";
  return `<span class=\"meta-chip ${className}\"${titleAttr}>${escapeHtml(normalized)}</span>`;
}

function renderHtml(
  title: string,
  apps: AppSection[],
  backlogs: AppBacklog[],
  ownerAppId: string,
  reviewPools: ReviewPools,
  ownerAppIconMetaHref?: string
): string {
  const reportLanguage = resolveReportLanguage(title);
  const reportTitle = resolveReportTitle(ownerAppId, title);
  const iconMetaHtml = ownerAppIconMetaHref
    ? `
    <link rel=\"icon\" type=\"image/png\" href=\"${escapeHtml(ownerAppIconMetaHref)}\" />
    <meta property=\"og:image\" content=\"${escapeHtml(ownerAppIconMetaHref)}\" />
    <meta name=\"twitter:image\" content=\"${escapeHtml(ownerAppIconMetaHref)}\" />
    `
    : "";
  function renderQuoteCard(params: {
    appTitle: string;
    appKey: string;
    categoryTitle: string;
    reviewId: string;
    meta: string;
    kr: string;
    org: string;
    defaultExcluded: boolean;
    defaultTags?: string[];
  }): string {
    const kr = escapeHtml(params.kr || "(한국어 번역 없음)");
    const org = escapeHtml(params.org || "(원문 없음)");
    const reviewId = escapeHtml(params.reviewId);
    const parsedMeta = parseQuoteMeta(params.meta);
    const ratingStars = formatRatingStars(parsedMeta.rating);
    const formattedDate = formatReadableDate(parsedMeta.date);
    const platformChip = renderMetaChip("meta-chip-platform", parsedMeta.platform);
    const ratingChip = ratingStars
      ? renderMetaChip("meta-chip-rating", ratingStars.stars, ratingStars.label)
      : "";
    const dateChip = renderMetaChip("meta-chip-date", formattedDate, parsedMeta.date || "");
    const rawMetaText =
      !platformChip && !ratingChip && !dateChip && parsedMeta.raw
        ? `<div class=\"quote-meta-fallback\">${escapeHtml(parsedMeta.raw)}</div>`
        : "";

    const textLength = normalizeText(params.kr || params.org).length;
    const defaultTags = Array.isArray(params.defaultTags)
      ? params.defaultTags.map((tag) => normalizeText(tag).toLowerCase()).filter(Boolean)
      : [];
    const defaultTagsAttr = defaultTags.join(",");

    return `
      <article class=\"quote-card searchable\" data-review-id=\"${reviewId}\" data-app-key=\"${escapeHtml(
        params.appKey
      )}\" data-default-excluded=\"${params.defaultExcluded ? "true" : "false"}\" data-default-tags=\"${escapeHtml(
        defaultTagsAttr
      )}\" data-text-length=\"${textLength}\" data-search=\"${escapeHtml(
        `${params.appTitle} ${params.categoryTitle} ${params.meta} ${params.kr} ${params.org}`
      ).toLowerCase()}\">
        <div class=\"quote-content\">
          <div class=\"quote-head\">
            <div class=\"quote-meta-group\">
              ${platformChip}
              ${ratingChip}
              ${dateChip}
            </div>
          </div>
          ${rawMetaText}
          <div class=\"quote-kr\">${kr}</div>
          <div class=\"quote-org org-text\">${org}</div>
        </div>
        <div class=\"quote-actions\">
          <button class=\"toggle-one\" type=\"button\" aria-label=\"원어 보기\" title=\"원어 보기\">
            <span class=\"toggle-label\">원어</span>
            <span class=\"toggle-icon\" aria-hidden=\"true\">▾</span>
          </button>
          <div class=\"quote-actions-right\">
            <div class=\"tag-actions\" role=\"group\" aria-label=\"해시태그\">
              <button class=\"tag-toggle tag-heart\" type=\"button\" data-tag=\"heart\" aria-label=\"❤️ 태그\" title=\"❤️ 태그\">#❤️</button>
              <button class=\"tag-toggle tag-satisfaction\" type=\"button\" data-tag=\"satisfaction\" aria-label=\"만족 태그\" title=\"만족 태그\">#만족</button>
              <button class=\"tag-toggle tag-dissatisfaction\" type=\"button\" data-tag=\"dissatisfaction\" aria-label=\"불만족 태그\" title=\"불만족 태그\">#불만족</button>
              <button class=\"tag-toggle tag-requests\" type=\"button\" data-tag=\"requests\" aria-label=\"요청 기능 태그\" title=\"요청 기능 태그\">#요청기능</button>
            </div>
            <button class=\"exclude-toggle\" type=\"button\">활성</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderCategorySection(categoryTitle: string, cardsHtml: string): string {
    return `
      <section class=\"category\">
        <h3>${escapeHtml(categoryTitle)}</h3>
        <div class=\"cards\">
          ${cardsHtml}
        </div>
      </section>
    `;
  }

  const appNoteApps: AppNoteApp[] = [];
  const rawAppSections = apps
    .map((app, appIndex) => {
      const appPool = resolvePoolForApp(app.title, reviewPools);
      const appKey = resolveAppStateKey(app.title, appPool);
      const parsedTitle = parseAppTitle(app.title);
      const links = extractStoreLinks(parsedTitle.sourceToken);
      appNoteApps.push({
        appKey,
        title: parsedTitle.displayName,
        sourceToken: parsedTitle.sourceToken,
        links
      });
      const seededReviewIds = new Set<string>();
      const selectedCards = (Object.keys(app.categories) as CategoryKey[])
        .flatMap((categoryKey) => {
          const items = app.categories[categoryKey];
          const categoryTitle = renderCategoryTitle(categoryKey);
          return items.map((item) => {
            const matchedReviewId = findPoolReviewIdForQuote(item, appPool);
            const reviewId = normalizeText(matchedReviewId) || normalizeText(item.reviewId);
            if (reviewId) {
              seededReviewIds.add(reviewId);
            }

            return renderQuoteCard({
              appTitle: app.title,
              appKey,
              categoryTitle,
              reviewId: reviewId || item.reviewId,
              meta: item.meta,
              kr: item.kr,
              org: item.org,
              defaultExcluded: false,
              defaultTags: resolveQuoteTags(item, categoryKey)
            });
          });
        })
        .join("\n");
      const selectedReviewsBlock = renderCategorySection(
        "선별 리뷰 (해시태그 기반)",
        selectedCards || `<p class=\"empty\">해당 항목 없음</p>`
      );

      const poolReviews = appPool?.reviews ?? [];
      const unselectedReviews = poolReviews.filter((review) => !seededReviewIds.has(review.reviewId));
      const fullPoolCards =
        unselectedReviews.length === 0
          ? `<p class=\"empty\">미선별 리뷰 없음</p>`
          : unselectedReviews
              .map((review) =>
                renderQuoteCard({
                  appTitle: app.title,
                  appKey,
                  categoryTitle: "전체 리뷰 풀",
                  reviewId: review.reviewId,
                  meta: review.meta,
                  kr: review.kr,
                  org: review.org,
                  defaultExcluded: true,
                  defaultTags: []
                })
              )
              .join("\n");
      const fullPoolBlock = `
        <section class=\"category category-pool\">
          <h3>전체 리뷰 풀 (미선별 · 기본 비활성)</h3>
          <div class=\"cards\">
            ${fullPoolCards}
          </div>
        </section>
      `;
      const defaultOpenAttr = appIndex < 2 ? " open" : "";
      const appReviewCountLabel = normalizeText(String(app.reviewCount ?? ""));
      const initialAppCountText = appReviewCountLabel
        ? `${appReviewCountLabel}/${appReviewCountLabel}`
        : "0/0";

      return `
        <details class=\"app\" data-app-key=\"${escapeHtml(appKey)}\" data-app-title=\"${escapeHtml(
          parsedTitle.displayName
        )}\" data-app-source-token=\"${escapeHtml(parsedTitle.sourceToken ?? "")}\"${defaultOpenAttr}>
          <summary>
            ${renderAppHeading(app.title)}
            <span class=\"app-summary-right\">
              <span class=\"app-count\">리뷰 ${escapeHtml(initialAppCountText)}</span>
            </span>
          </summary>
          <div class=\"app-body\">
            ${selectedReviewsBlock}
            ${fullPoolBlock}
          </div>
        </details>
      `;
    })
    .join("\n");
  const appNoteSelectOptionsHtml = appNoteApps
    .map(
      (app, index) =>
        `<option value=\"${escapeHtml(app.appKey)}\"${index === 0 ? " selected" : ""}>${escapeHtml(app.title)}</option>`
    )
    .join("");
  const appNoteAppsJson = toInlineJson(appNoteApps);

  const groupedBacklog = new Map<
    string,
    {
      priority: Priority;
      title: string;
      impact: Impact;
      effort: Effort;
      action: string;
      evidenceReviewIds: Set<string>;
      evidenceQuoteById: Map<string, QuoteItem>;
      appNames: Set<string>;
    }
  >();

  for (const appBacklog of backlogs) {
    const parsedAppTitle = parseAppTitle(appBacklog.appTitle);
    const appName = normalizeText(parsedAppTitle.displayName);

    for (const item of appBacklog.items) {
      const groupKey = `${normalizeText(item.title).toLowerCase()}||${normalizeText(item.action).toLowerCase()}`;
      const existing = groupedBacklog.get(groupKey);

      if (!existing) {
        const evidenceQuoteById = new Map<string, QuoteItem>();
        for (const quote of item.examples) {
          const quoteKey =
            normalizeText(quote.evidenceKey).toLowerCase() ||
            normalizeText(quote.reviewId).toLowerCase() ||
            `${normalizeText(quote.kr).toLowerCase()}||${normalizeText(quote.org).toLowerCase()}`;
          if (!quoteKey || evidenceQuoteById.has(quoteKey)) {
            continue;
          }
          evidenceQuoteById.set(quoteKey, quote);
        }

        groupedBacklog.set(groupKey, {
          priority: item.priority,
          title: item.title,
          impact: item.impact,
          effort: item.effort,
          action: item.action,
          evidenceReviewIds: new Set<string>(item.evidenceReviewIds),
          evidenceQuoteById,
          appNames: new Set<string>(appName ? [appName] : []),
        });
        continue;
      }

      for (const reviewId of item.evidenceReviewIds) {
        existing.evidenceReviewIds.add(reviewId);
      }
      if (appName) {
        existing.appNames.add(appName);
      }
      if (priorityOrder(item.priority) < priorityOrder(existing.priority)) {
        existing.priority = item.priority;
      }
      for (const quote of item.examples) {
        const quoteKey =
          normalizeText(quote.evidenceKey).toLowerCase() ||
          normalizeText(quote.reviewId).toLowerCase() ||
          `${normalizeText(quote.kr).toLowerCase()}||${normalizeText(quote.org).toLowerCase()}`;
        if (!quoteKey || existing.evidenceQuoteById.has(quoteKey)) {
          continue;
        }
        existing.evidenceQuoteById.set(quoteKey, quote);
      }
    }
  }

  const unifiedBacklogItems: UnifiedBacklogItem[] = [...groupedBacklog.values()]
    .map((item) => {
      const evidenceIds = [...item.evidenceReviewIds];
      const examples = evidenceIds
        .map((reviewId) => item.evidenceQuoteById.get(reviewId))
        .filter((quote): quote is QuoteItem => Boolean(quote));

      return {
        priority: item.priority,
        title: item.title,
        impact: item.impact,
        effort: item.effort,
        action: item.action,
        evidenceCount: item.evidenceReviewIds.size,
        examples,
        appNames: [...item.appNames].sort((a, b) => a.localeCompare(b))
      };
    })
    .sort((a, b) => {
      if (priorityOrder(a.priority) !== priorityOrder(b.priority)) {
        return priorityOrder(a.priority) - priorityOrder(b.priority);
      }
      return b.evidenceCount - a.evidenceCount;
    });

  const backlogRows =
    unifiedBacklogItems.length === 0
      ? `<tr><td colspan=\"5\" class=\"empty\">추출된 리포트 없음</td></tr>`
      : unifiedBacklogItems
          .map((item, itemIndex) => {
            const evidenceId = `evidence-${itemIndex}`;
            const examples = item.examples
              .map((q, quoteIndex) => {
                const detailId = `evidence-detail-${itemIndex}-${quoteIndex}`;
                const parsed = parseQuoteMeta(q.meta);
                const detailMeta = [
                  q.reviewId ? `리뷰 ID: ${q.reviewId}` : "",
                  parsed.platform ? `플랫폼: ${parsed.platform}` : "",
                  parsed.rating ? `평점: ${parsed.rating}` : "",
                  parsed.date ? `날짜: ${parsed.date}` : ""
                ]
                  .filter(Boolean)
                  .join(" · ");
                const detailFallback = detailMeta || (parsed.raw ? `메타: ${parsed.raw}` : "메타: -");

                return `
                    <li>
                      <div class=\"example-kr\">${escapeHtml(q.kr || q.org)}</div>
                      <div class=\"evidence-detail-actions\">
                        <button
                          class=\"evidence-detail-toggle\"
                          type=\"button\"
                          data-evidence-detail-id=\"${escapeHtml(detailId)}\"
                          aria-expanded=\"false\"
                        >자세히보기</button>
                      </div>
                      <div id=\"${escapeHtml(detailId)}\" class=\"evidence-detail\">
                        <div class=\"evidence-detail-meta\">${escapeHtml(detailFallback)}</div>
                        <div class=\"example-org\">원문: ${escapeHtml(q.org || "(원문 없음)")}</div>
                      </div>
                    </li>
                  `;
              })
              .join("\n");
            const appLabel = item.appNames.join(", ");

            return `
                  <tr class=\"backlog-item main-row searchable\" data-priority=\"${escapeHtml(
                    item.priority
                  )}\" data-search=\"${escapeHtml(
              `${appLabel} ${item.priority} ${item.title} ${item.action} ${item.examples
                .map((q) => `${q.kr} ${q.org}`)
                .join(" ")}`
            ).toLowerCase()}\" data-evidence-id=\"${escapeHtml(evidenceId)}\">
                    <td>${renderPriorityBadge(item.priority)}</td>
                    <td>
                      <div class=\"item-title\">${escapeHtml(item.title)}</div>
                      <div class=\"item-action\">${escapeHtml(item.action)}</div>
                      <div class=\"item-app\" title=\"${escapeHtml(appLabel)}\">앱: ${escapeHtml(appLabel)}</div>
                    </td>
                    <td>${renderLevel(item.impact)}</td>
                    <td>${renderLevel(item.effort)}</td>
                    <td>
                      <div class=\"evidence-count-cell\">
                        <span class=\"evidence-count-value\">${item.evidenceCount}</span>
                        <button class=\"evidence-toggle\" type=\"button\" data-evidence-id=\"${escapeHtml(
                          evidenceId
                        )}\" aria-expanded=\"false\" aria-label=\"근거 보기\" title=\"근거 보기\">
                          <span class=\"evidence-toggle-icon\" aria-hidden=\"true\">▾</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr id=\"${escapeHtml(evidenceId)}\" class=\"evidence-row\">
                    <td colspan=\"5\">
                      <div class=\"evidence-panel\">
                        <ul class=\"evidence-list\">${examples}</ul>
                      </div>
                    </td>
                  </tr>
                `;
          })
          .join("\n");

  const backlogSections = `
    <section class=\"app backlog-unified\">
      <div class=\"app-body\">
        <div class=\"table-wrap\">
          <table class=\"backlog-table\">
            <colgroup>
              <col class=\"col-priority\" />
              <col class=\"col-item\" />
              <col class=\"col-impact\" />
              <col class=\"col-effort\" />
              <col class=\"col-evidence\" />
            </colgroup>
            <thead>
              <tr>
                <th>Priority</th>
                <th>백로그 항목</th>
                <th>Impact</th>
                <th>Effort</th>
                <th>근거 수</th>
              </tr>
            </thead>
            <tbody>
              ${backlogRows}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `;

  const totalBacklogItems = unifiedBacklogItems.length;
  const totalMustItems = unifiedBacklogItems.filter((item) => item.priority === "must").length;
  const totalShouldItems = unifiedBacklogItems.filter((item) => item.priority === "should").length;
  const totalCouldItems = unifiedBacklogItems.filter((item) => item.priority === "could").length;
  const rawSummaryHtml = `
    <section class=\"review-summary\">
      <p><strong>앱 수 ${apps.length}</strong></p>
      <p><strong>해시태그 정의:</strong> #요청기능 · #불만족 · #만족 · #❤️</p>
      <p>활성 리뷰를 해시태그 기준으로 분류하고 필터링할 때 사용</p>
      <p><strong>활성 상태 정의:</strong> 리포트 반영 후보 여부</p>
      <p>추가 검토/반영 대상이면 활성, 보류·중복이면 비활성</p>
    </section>
  `;
  const backlogSummaryHtml = `
    <section class=\"backlog-summary\">
      <p><strong>백로그 항목 ${totalBacklogItems}</strong> · MUST ${totalMustItems} · SHOULD ${totalShouldItems} · COULD ${totalCouldItems}</p>
      <p>우선순위 규칙(해시태그 기준): 요청×3 + 불만×2 + 만족×1</p>
    </section>
  `;
  const ownerAppIconHref = ownerAppId ? `/assets/app-icons/${encodeURIComponent(ownerAppId)}.png` : "";
  const ownerAppIdentityHtml = ownerAppId
    ? `<div class=\"owner-app\" aria-label=\"Owner app\">
          <img class=\"owner-app-icon\" src=\"${escapeHtml(ownerAppIconHref)}\" alt=\"${escapeHtml(
            ownerAppId
          )} icon\" loading=\"lazy\" decoding=\"async\"
            onerror=\"this.style.display='none';if(this.nextElementSibling){this.nextElementSibling.style.display='inline-flex';}\" />
          <span class=\"owner-app-fallback\">${escapeHtml(ownerAppId)}</span>
        </div>`
    : "";

  return `<!doctype html>
<html lang=\"${reportLanguage}\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>${escapeHtml(reportTitle)}</title>
    <meta property=\"og:title\" content=\"${escapeHtml(reportTitle)}\" />
    <meta name=\"twitter:title\" content=\"${escapeHtml(reportTitle)}\" />
    ${iconMetaHtml}
    <style>
      :root {
        --bg: #f3f7fc;
        --bg-alt: #edf4fb;
        --panel: #ffffff;
        --panel-soft: #f7fbff;
        --panel-elevated: #f1f8ff;
        --ink: #0f172a;
        --sub: #475569;
        --line: #d9e5f1;
        --line-strong: #bbcee0;
        --accent: #0ea5e9;
        --accent-soft: rgba(14, 165, 233, 0.14);
        --must: #dc2626;
        --should: #ea580c;
        --could: #15803d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Pretendard", "Noto Sans KR", "Apple SD Gothic Neo", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 0% 0%, #d8e8fb 0%, rgba(216, 232, 251, 0) 36%),
          radial-gradient(circle at 92% 4%, #dbf0ff 0%, rgba(219, 240, 255, 0) 42%),
          linear-gradient(180deg, var(--bg-alt) 0%, var(--bg) 100%);
      }
      .wrap {
        max-width: 1240px;
        margin: 0 auto;
        padding: 24px 14px 52px;
      }
      .top {
        position: sticky;
        top: 0;
        z-index: 20;
        backdrop-filter: blur(10px);
        background: rgba(243, 247, 252, 0.86);
        border-bottom: 1px solid var(--line);
        box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
      }
      .top-inner {
        max-width: 1240px;
        margin: 0 auto;
        padding: 10px 14px;
      }
      .top-main {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .top-status-row {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        border-top: 1px solid var(--line);
        background: rgba(248, 251, 255, 0.72);
      }
      .top-left {
        display: inline-flex;
        align-items: center;
        gap: 12px;
        flex: 1 1 auto;
        flex-wrap: wrap;
        min-width: 0;
      }
      .search-fixed {
        width: auto;
        max-width: min(520px, 100%);
        flex: 0 0 auto;
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        justify-content: flex-end;
        gap: 8px;
      }
      .search-toggle-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: #ffffff;
        color: #0f172a;
        font-size: 16px;
        line-height: 1;
        padding: 0;
      }
      .search-toggle-btn:hover {
        border-color: #0ea5e9;
        background: #f0f9ff;
        color: #075985;
      }
      .top-controls {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }
      .top-filters-left {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .active-filter-chips {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .raw-pagination {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: auto;
        padding: 4px 8px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #f8fbff;
      }
      .raw-pagination button {
        min-width: 52px;
        padding: 6px 10px;
        font-size: 12px;
      }
      .raw-total-count {
        color: #334155;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
      }
      .raw-page-info {
        color: #334155;
        font-size: 12px;
        font-weight: 700;
        min-width: 72px;
        text-align: center;
      }
      .active-filter-chip {
        border: 1px solid #cbdceb;
        background: #eef6ff;
        color: #1e3a5f;
        border-radius: 999px;
        padding: 3px 10px;
        font-size: 11px;
        font-weight: 700;
      }
      .clear-filters-btn {
        background: #ffffff;
      }
      .open-filter-panel-btn.is-active,
      #openNoteSidebar.is-active {
        border-color: #0369a1;
        color: #075985;
        background: #e0f2fe;
      }
      .home-link {
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        min-height: 36px;
        padding: 0;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--ink);
        font-size: 18px;
        font-weight: 700;
        line-height: 1;
        transition: border-color 120ms ease, color 120ms ease, background-color 120ms ease;
      }
      .owner-app {
        display: inline-flex;
        align-items: center;
        min-height: 36px;
        gap: 6px;
        min-width: 0;
      }
      .owner-app-icon {
        width: 24px;
        height: 24px;
        border-radius: 0;
        object-fit: cover;
        border: 0;
        background: transparent;
        flex: 0 0 auto;
      }
      .owner-app-fallback {
        display: none;
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 2px 9px;
        font-size: 12px;
        color: var(--sub);
        background: var(--panel);
        white-space: nowrap;
      }
      .tabs {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel);
      }
      .tab-btn {
        border: 0;
        background: transparent;
        color: var(--sub);
        border-radius: 9px;
        min-height: 36px;
        padding: 8px 12px;
        font-size: 13px;
        font-weight: 700;
        line-height: 1;
        cursor: pointer;
        transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
      }
      .tab-btn.active {
        color: #075985;
        background: #e0f2fe;
        box-shadow: inset 0 0 0 1px #7dd3fc;
      }
      .tab-btn:not(.active):hover {
        color: var(--ink);
        background: #eef5fc;
      }
      h1 {
        margin: 8px 0 12px;
        font-size: 1.78rem;
        letter-spacing: -0.02em;
      }
      .review-summary {
        margin: 0 0 14px;
        color: var(--sub);
        font-size: 13px;
        line-height: 1.45;
      }
      .review-summary p {
        margin: 0 0 4px;
      }
      .review-summary p:last-child {
        margin-bottom: 0;
      }
      .review-summary strong {
        color: var(--ink);
      }
      .context-panel {
        display: none;
      }
      .context-panel.active {
        display: block;
      }
      .backlog-summary {
        margin: 0 0 14px;
        color: var(--sub);
        font-size: 13px;
        line-height: 1.45;
      }
      .backlog-summary p {
        margin: 0 0 4px;
      }
      .backlog-summary p:last-child {
        margin-bottom: 0;
      }
      .backlog-summary strong {
        color: var(--ink);
      }
      input[type="search"] {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        font-size: 14px;
        background: #ffffff;
        color: var(--ink);
        transition: opacity 180ms ease, transform 180ms ease, border-color 120ms ease, box-shadow 120ms ease;
      }
      input[type="search"]::placeholder {
        color: #7b8ca2;
      }
      input[type="search"]:focus {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-soft);
        outline: none;
      }
      .search-fixed input[type="search"] {
        width: 0;
        min-width: 0;
        padding: 0;
        border-width: 0;
        opacity: 0;
        pointer-events: none;
        transform: translateX(4px);
      }
      .top.is-search-open .search-fixed input[type="search"] {
        width: min(460px, 52vw);
        min-width: 220px;
        padding: 10px 12px;
        border-width: 1px;
        opacity: 1;
        pointer-events: auto;
        transform: translateX(0);
      }
      button {
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--ink);
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 13px;
      }
      button {
        cursor: pointer;
        transition: border-color 120ms ease, background-color 120ms ease, color 120ms ease;
      }
      button:disabled {
        cursor: not-allowed;
        color: #94a3b8;
        background: #f8fafc;
      }
      .toggle-all-label,
      .toggle-length-label {
        display: flex;
        align-items: center;
        gap: 8px;
        min-height: 36px;
        width: fit-content;
        padding: 0 10px;
        border: 1px solid #c7d6e8;
        border-radius: 12px;
        background: #ffffff;
        color: #0f172a;
        font-size: 12px;
        font-weight: 700;
        line-height: 1.2;
        cursor: pointer;
      }
      .toggle-all-label:hover,
      .toggle-length-label:hover {
        border-color: #9db0c6;
        background: #f8fbff;
      }
      .exclude-filter,
      .tag-filter {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        padding: 5px;
        gap: 5px;
        border: 1px solid #c7d6e8;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
      }
      .toggle-all-label input,
      .toggle-length-label input {
        width: 16px;
        height: 16px;
        margin: 0;
        accent-color: var(--accent);
      }
      .exclude-filter-btn {
        border: 1px solid transparent;
        background: transparent;
        border-radius: 10px;
        padding: 6px 10px;
        min-height: 32px;
        font-size: 12px;
        font-weight: 700;
        color: var(--sub);
      }
      .exclude-filter-btn.is-active {
        border-color: #0ea5e9;
        color: #075985;
        background: #e0f2fe;
      }
      .tag-filter-btn {
        border: 1px solid transparent;
        background: transparent;
        border-radius: 10px;
        padding: 6px 10px;
        min-height: 32px;
        font-size: 12px;
        font-weight: 700;
        color: var(--sub);
      }
      .tag-filter-btn.is-active {
        border-color: #eab308;
        color: #92400e;
        background: #fef9c3;
      }
      .priority-filter {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        padding: 5px;
        gap: 5px;
        border: 1px solid #c7d6e8;
        border-radius: 12px;
        background: #ffffff;
        box-shadow: 0 1px 0 rgba(15, 23, 42, 0.03);
      }
      .priority-filter-btn {
        border: 1px solid transparent;
        background: transparent;
        border-radius: 10px;
        padding: 6px 10px;
        min-height: 32px;
        font-size: 12px;
        font-weight: 700;
        color: var(--sub);
      }
      .priority-filter-btn.is-active {
        border-color: #0ea5e9;
        color: #075985;
        background: #e0f2fe;
      }
      .clear-filters-btn {
        border-color: #c7d6e8;
        background: #ffffff;
        border-radius: 10px;
        padding: 6px 10px;
        min-height: 34px;
        font-size: 12px;
        font-weight: 700;
      }
      .clear-filters-btn:hover {
        border-color: #94a3b8;
        background: #f8fbff;
      }
      .filter-summary {
        display: inline-flex;
        align-items: center;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid var(--line);
        background: #f8fbff;
        color: var(--sub);
        font-size: 12px;
        font-weight: 700;
        min-width: 118px;
        justify-content: center;
      }
      .page-filter-summary {
        margin: 0;
      }
      .hidden-control {
        display: none !important;
      }
      .home-link:hover {
        border-color: var(--accent);
        color: #0369a1;
        background: var(--accent-soft);
      }
      .app {
        border: 1px solid var(--line);
        border-radius: 14px;
        margin-bottom: 14px;
        background: #ffffff;
        overflow: hidden;
        box-shadow: 0 16px 32px rgba(15, 23, 42, 0.07);
        animation: card-enter 280ms ease both;
        content-visibility: auto;
        contain-intrinsic-size: 480px;
      }
      .app > summary {
        cursor: pointer;
        list-style: none;
        padding: 13px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        background: linear-gradient(180deg, #ffffff, #f6faff);
      }
      .app > summary::-webkit-details-marker { display: none; }
      .app-heading {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .app-title { font-weight: 700; }
      .app-token { color: var(--sub); font-size: 12px; }
      .store-links {
        display: inline-flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .store-link {
        text-decoration: none;
        color: var(--sub);
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 2px 8px;
        font-size: 11px;
        background: #ffffff;
      }
      .store-link:hover {
        border-color: var(--accent);
        color: #0369a1;
      }
      .app-summary-right {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .app-count { color: var(--sub); font-size: 12px; }
      .app-body { padding: 4px 12px 12px; }
      .category h3 { margin: 12px 2px 8px; font-size: 1rem; }
      .cards {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        align-items: stretch;
      }
      .quote-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #ffffff;
        display: flex;
        flex-direction: column;
        min-height: 100%;
        overflow: hidden;
        content-visibility: auto;
        contain-intrinsic-size: 220px;
      }
      .quote-card.has-heart-tag {
        border-color: #eab308;
        box-shadow: 0 0 0 2px rgba(234, 179, 8, 0.15);
      }
      .quote-card.is-excluded {
        opacity: 0.62;
      }
      .category-pool h3 {
        margin-top: 16px;
      }
      .quote-content {
        padding: 12px 14px 8px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .quote-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .quote-meta-group {
        display: inline-flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .meta-chip {
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        border: 1px solid var(--line);
        padding: 2px 8px;
        font-size: 11px;
        font-weight: 700;
        line-height: 1.25;
      }
      .meta-chip-platform {
        color: #075985;
        background: #e0f2fe;
        border-color: #bae6fd;
      }
      .meta-chip-rating {
        color: #9a3412;
        background: #ffedd5;
        border-color: #fed7aa;
        letter-spacing: 0.04em;
      }
      .meta-chip-date {
        color: #475569;
        background: #f8fafc;
      }
      .quote-meta-fallback {
        color: var(--sub);
        font-size: 12px;
      }
      .quote-kr {
        font-size: 15px;
        line-height: 1.55;
        font-weight: 600;
        letter-spacing: -0.01em;
      }
      .org-text {
        display: none;
        color: #334155;
        font-size: 13px;
        line-height: 1.4;
      }
      .quote-card .quote-org {
        display: block;
        margin-top: 0;
        padding-top: 0;
        border-top: 1px dashed transparent;
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transform: translateY(-4px);
        pointer-events: none;
        transition:
          max-height 300ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 220ms ease,
          transform 300ms cubic-bezier(0.22, 1, 0.36, 1),
          margin-top 260ms ease,
          padding-top 260ms ease,
          border-color 220ms ease;
      }
      body.show-all-original #viewRaw .quote-card .quote-org,
      .quote-card.show-one-original .quote-org {
        margin-top: 8px;
        padding-top: 8px;
        border-top-color: var(--line);
        max-height: 1600px;
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      .quote-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        margin-top: auto;
        padding: 10px 12px;
        border-top: 1px dashed var(--line);
        background: #f8fbff;
        justify-content: space-between;
        align-items: center;
      }
      .quote-actions-right {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .toggle-one,
      .exclude-toggle,
      .tag-toggle {
        font-size: 12px;
        padding: 6px 8px;
        cursor: pointer;
      }
      .tag-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .tag-toggle {
        border-radius: 999px;
        border-color: #d5e1ed;
        color: #475569;
        background: #ffffff;
        font-weight: 700;
      }
      .tag-toggle.is-active {
        color: #111827;
      }
      .tag-heart.is-active {
        border-color: #eab308;
        color: #92400e;
        background: #fef9c3;
      }
      .tag-satisfaction.is-active {
        border-color: #16a34a;
        color: #166534;
        background: #dcfce7;
      }
      .tag-dissatisfaction.is-active {
        border-color: #dc2626;
        color: #991b1b;
        background: #fee2e2;
      }
      .tag-requests.is-active {
        border-color: #2563eb;
        color: #1e3a8a;
        background: #dbeafe;
      }
      .tag-toggle:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      .toggle-one {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: #0f172a;
        padding: 2px 0;
        font-weight: 700;
      }
      .toggle-one:hover {
        color: #0369a1;
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      .toggle-icon {
        display: inline-flex;
        width: 16px;
        justify-content: center;
        color: #0ea5e9;
        transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      body.show-all-original #viewRaw .quote-card .toggle-icon,
      .quote-card.show-one-original .toggle-icon {
        transform: rotate(180deg);
      }
      .exclude-toggle {
        color: #ffffff;
        border-color: transparent;
        font-weight: 700;
      }
      .exclude-toggle:not(.is-active) {
        background: #16a34a;
      }
      .exclude-toggle.is-active {
        background: #dc2626;
      }
      .note-sidebar-root[hidden] {
        display: none;
      }
      .filter-panel-root[hidden] {
        display: none;
      }
      .filter-panel-root {
        position: fixed;
        inset: 0;
        z-index: 46;
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
      }
      .filter-panel-root.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .filter-panel-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.34);
        opacity: 0;
        transition: opacity 180ms ease;
      }
      .filter-panel-root.is-open .filter-panel-backdrop {
        opacity: 1;
      }
      .filter-panel {
        position: absolute;
        right: 0;
        top: 0;
        width: min(420px, 100vw);
        height: 100%;
        border-left: 1px solid var(--line);
        background: #ffffff;
        display: flex;
        flex-direction: column;
        box-shadow: -12px 0 30px rgba(15, 23, 42, 0.18);
        opacity: 0;
        transform: translateX(20px);
        transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease;
      }
      .filter-panel-root.is-open .filter-panel {
        opacity: 1;
        transform: translateX(0);
      }
      .filter-panel-head {
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        display: flex;
        flex-direction: column;
        align-items: stretch;
        justify-content: flex-start;
        gap: 8px;
        background: #ffffff;
      }
      .filter-panel-head-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .filter-panel-head h2 {
        margin: 0;
        font-size: 1rem;
        line-height: 1.2;
      }
      .filter-panel-head-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .filter-panel-head button {
        border-radius: 10px;
        padding: 6px 10px;
        min-height: 34px;
        font-size: 12px;
        font-weight: 700;
        background: #ffffff;
        border-color: #c7d6e8;
      }
      .filter-panel-head button:hover {
        border-color: #9db0c6;
        background: #f8fbff;
      }
      .filter-panel-summary {
        margin: 0;
        align-self: flex-start;
      }
      .filter-panel-icon-btn {
        width: 34px;
        height: 34px;
        min-height: 34px;
        padding: 0;
        font-size: 16px;
        line-height: 1;
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
      .filter-panel-body {
        padding: 10px 14px 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
        text-align: left;
        overflow: auto;
      }
      .filter-field {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .filter-field-title {
        margin: 0;
        padding: 0;
        color: #475569;
        font-size: 12px;
        font-weight: 700;
        text-align: left;
      }
      .filter-panel-body .toggle-all-label,
      .filter-panel-body .toggle-length-label {
        align-self: flex-start;
      }
      .filter-panel-body .tag-filter,
      .filter-panel-body .exclude-filter {
        width: 100%;
        justify-content: flex-start;
      }
      .filter-panel-body .clear-filters-btn {
        align-self: flex-start;
      }
      .filter-panel-foot {
        margin-top: 0;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
      }
      .filter-panel-foot .clear-filters-btn {
        width: auto;
        justify-content: flex-start;
      }
      .bulk-exclude-btn {
        border-color: #fca5a5;
        color: #991b1b;
        background: #fff1f2;
      }
      .bulk-exclude-btn:hover {
        border-color: #ef4444;
        background: #ffe4e6;
      }
      .note-sidebar-root {
        position: fixed;
        inset: 0;
        z-index: 50;
        opacity: 0;
        pointer-events: none;
        transition: opacity 180ms ease;
      }
      .note-sidebar-root.is-open {
        opacity: 1;
        pointer-events: auto;
      }
      .note-sidebar-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.38);
        opacity: 0;
        transition: opacity 180ms ease;
      }
      .note-sidebar-root.is-open .note-sidebar-backdrop {
        opacity: 1;
      }
      .note-sidebar {
        position: absolute;
        right: 0;
        top: 0;
        width: min(420px, 100vw);
        height: 100%;
        border-left: 1px solid var(--line);
        background: #ffffff;
        display: flex;
        flex-direction: column;
        box-shadow: -12px 0 30px rgba(15, 23, 42, 0.18);
        opacity: 0;
        transform: translateX(20px);
        transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease;
      }
      .note-sidebar-root.is-open .note-sidebar {
        opacity: 1;
        transform: translateX(0);
      }
      .note-sidebar-head {
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .note-sidebar-head h2 {
        margin: 0;
        font-size: 1rem;
      }
      .note-sidebar-sub {
        font-size: 12px;
        color: var(--sub);
      }
      .note-sidebar-head-actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .note-sidebar-head-actions button {
        font-size: 12px;
        font-weight: 700;
        padding: 6px 10px;
      }
      .note-app-select-wrap {
        padding: 10px 14px;
        border-bottom: 1px solid var(--line);
        background: #f8fbff;
      }
      .note-app-select {
        width: 100%;
        min-height: 38px;
        border: 1px solid #c7d6e8;
        border-radius: 10px;
        background: #ffffff;
        color: #0f172a;
        font-size: 13px;
        font-weight: 700;
        padding: 0 11px;
      }
      .note-app-meta {
        padding: 10px 14px;
        border-bottom: 1px dashed var(--line);
        background: #ffffff;
      }
      .note-app-links {
        margin-top: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .note-link {
        text-decoration: none;
        border: 1px solid #c7d6e8;
        border-radius: 999px;
        padding: 3px 9px;
        font-size: 11px;
        font-weight: 700;
        color: #334155;
        background: #ffffff;
      }
      .note-link:hover {
        border-color: #0ea5e9;
        color: #075985;
        background: #f0f9ff;
      }
      .note-link-empty {
        color: #64748b;
        font-size: 12px;
      }
      .note-sidebar textarea {
        flex: 1;
        width: 100%;
        border: 0;
        padding: 14px;
        resize: none;
        outline: none;
        font: inherit;
        line-height: 1.5;
      }
      .note-sidebar-foot {
        border-top: 1px solid var(--line);
        padding: 10px 14px;
        font-size: 12px;
        color: var(--sub);
        background: #f8fbff;
      }
      .empty { margin: 0; color: var(--sub); font-size: 13px; }
      .hidden-by-search { display: none !important; }
      .hidden-by-state { display: none !important; }
      .hidden-by-page { display: none !important; }
      .view { display: none; }
      .view.active { display: block; }
      .table-wrap { overflow-x: auto; }
      table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: #ffffff;
      }
      .backlog-table {
        table-layout: fixed;
      }
      .backlog-table col.col-priority {
        width: 112px;
      }
      .backlog-table col.col-impact,
      .backlog-table col.col-effort {
        width: 118px;
      }
      .backlog-table col.col-evidence {
        width: 120px;
      }
      .backlog-table td:nth-child(2) {
        min-width: 0;
      }
      th, td {
        padding: 9px 10px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
        font-size: 13px;
      }
      th { background: #f8fbff; color: #0f172a; }
      .main-row:hover td {
        background: #f8fbff;
      }
      .item-title { font-weight: 700; margin-bottom: 4px; }
      .item-action {
        color: #334155;
        line-height: 1.4;
      }
      .item-app {
        margin-top: 6px;
        color: #64748b;
        font-size: 12px;
        display: block;
        max-width: 100%;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .badge {
        display: inline-block;
        border-radius: 999px;
        font-size: 11px;
        font-weight: 700;
        padding: 3px 8px;
        color: #fff;
      }
      .badge-must { background: var(--must); }
      .badge-should { background: var(--should); }
      .badge-could { background: var(--could); }
      .evidence-count-cell {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .evidence-count-value {
        font-weight: 600;
      }
      .evidence-toggle {
        cursor: pointer;
        width: 28px;
        height: 28px;
        border-radius: 999px;
        border: 1px solid #cbd5e1;
        background: #fff;
        color: #0f172a;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
      }
      .evidence-toggle:hover {
        background: #f8fafc;
        border-color: #94a3b8;
      }
      .evidence-toggle-icon {
        display: inline-block;
        font-size: 14px;
        line-height: 1;
        transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      .evidence-toggle[aria-expanded="true"] .evidence-toggle-icon {
        transform: rotate(180deg);
      }
      .evidence-row td {
        padding: 0;
        background: #f8fbff;
        border-bottom: 0;
      }
      .evidence-row.hidden-by-search {
        display: none;
      }
      .evidence-panel {
        padding: 0 12px;
        border-top: 1px dashed transparent;
        overflow: hidden;
        max-height: 0;
        opacity: 0;
        transform: translateY(-3px);
        transition:
          max-height 280ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 220ms ease,
          transform 280ms cubic-bezier(0.22, 1, 0.36, 1),
          padding 280ms cubic-bezier(0.22, 1, 0.36, 1),
          border-color 220ms ease;
      }
      .evidence-row.open td {
        border-bottom: 1px solid var(--line);
      }
      .evidence-row.open .evidence-panel {
        padding: 12px;
        border-top-color: var(--line);
        max-height: 999999px;
        opacity: 1;
        transform: translateY(0);
      }
      .evidence-list { margin: 0; padding-left: 16px; }
      .evidence-list li { margin-bottom: 8px; }
      .example-kr { line-height: 1.35; }
      .example-org { margin-top: 6px; }
      .evidence-detail-actions {
        margin-top: 4px;
        display: flex;
        justify-content: flex-end;
      }
      .evidence-detail-toggle {
        border: 0;
        background: transparent;
        padding: 0;
        color: #2563eb;
        font-size: 12px;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
      .evidence-detail {
        margin-top: 0;
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transform: translateY(-3px);
        transition:
          max-height 260ms cubic-bezier(0.22, 1, 0.36, 1),
          opacity 200ms ease,
          transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
          margin-top 220ms ease;
      }
      .evidence-detail.open {
        margin-top: 6px;
        max-height: 99999px;
        opacity: 1;
        transform: translateY(0);
      }
      .evidence-detail-meta {
        color: #64748b;
        font-size: 12px;
        line-height: 1.35;
      }
      .evidence-detail .example-org {
        margin-top: 6px;
        padding-bottom: 10px;
      }
      a:focus-visible,
      button:focus-visible,
      input:focus-visible,
      summary:focus-visible {
        outline: 2px solid var(--accent);
        outline-offset: 2px;
      }
      @keyframes card-enter {
        from { opacity: 0; transform: translateY(4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @media (max-width: 1100px) {
        .top.is-search-open .search-fixed input[type="search"] {
          width: min(420px, 48vw);
          min-width: 200px;
        }
      }
      @media (max-width: 900px) {
        .top-main {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }
        .top-left {
          flex: 1 1 100%;
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: nowrap;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .top-left::-webkit-scrollbar {
          display: none;
        }
        .search-fixed {
          margin-left: 0;
          width: auto;
          max-width: 100%;
          flex: none;
          min-height: 36px;
        }
        .top.is-search-open .search-fixed input[type="search"] {
          width: min(360px, 56vw);
          min-width: 160px;
          padding: 10px 12px;
        }
        .top-controls {
          margin-left: 0;
          width: auto;
          justify-content: flex-end;
          gap: 8px;
        }
        .top-controls button {
          flex: 0 0 auto;
          min-height: 36px;
          padding: 7px 12px;
          font-size: 13px;
          font-weight: 700;
          border-radius: 12px;
        }
        .tabs {
          margin-left: auto;
        }
      }
      @media (max-width: 780px) {
        .top-inner {
          padding: 8px 12px;
        }
        .home-link {
          width: 34px;
          min-height: 34px;
          font-size: 17px;
        }
        .owner-app-icon {
          width: 22px;
          height: 22px;
        }
        .tabs {
          padding: 3px;
          gap: 3px;
        }
        .tab-btn {
          min-height: 34px;
          padding: 7px 10px;
        }
        .search-fixed {
          max-width: 100%;
        }
        .top.is-search-open .search-fixed input[type="search"] {
          width: min(300px, 60vw);
          min-width: 140px;
          padding: 9px 11px;
        }
        .top-status-row {
          gap: 8px;
          align-items: center;
        }
        .active-filter-chips {
          width: 100%;
          order: 1;
        }
        .filter-summary {
          order: 2;
          min-height: 36px;
          padding: 8px 12px;
          border-radius: 12px;
          justify-content: center;
        }
        .priority-filter {
          order: 3;
          width: auto;
          max-width: 100%;
        }
        .raw-pagination {
          order: 4;
          margin-left: 0;
          width: auto;
          min-width: 260px;
          flex: 1 1 320px;
          max-width: 100%;
          justify-content: space-between;
          flex-wrap: nowrap;
          padding: 6px 8px;
          gap: 6px;
        }
        .raw-pagination button {
          min-width: 48px;
          padding: 6px 8px;
        }
        .raw-total-count {
          min-width: 90px;
        }
        .raw-page-info {
          min-width: 50px;
        }
        .filter-panel {
          right: 0;
          left: 0;
          top: auto;
          bottom: 0;
          width: 100%;
          height: auto;
          max-height: min(82vh, 680px);
          border-left: 0;
          border-top: 1px solid var(--line);
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -16px 34px rgba(15, 23, 42, 0.22);
          transform: translateY(20px);
        }
        .filter-panel-root.is-open .filter-panel {
          transform: translateY(0);
        }
        .note-sidebar {
          right: 0;
          left: 0;
          top: auto;
          bottom: 0;
          width: 100%;
          height: min(84vh, 720px);
          border-left: 0;
          border-top: 1px solid var(--line);
          border-radius: 16px 16px 0 0;
          box-shadow: 0 -16px 34px rgba(15, 23, 42, 0.24);
          transform: translateY(20px);
        }
        .note-sidebar-root.is-open .note-sidebar {
          transform: translateY(0);
        }
        .note-sidebar-head {
          padding: 10px 12px;
        }
        .note-sidebar-head-actions {
          gap: 4px;
        }
        .note-sidebar-head-actions button {
          min-height: 34px;
          padding: 6px 9px;
        }
        .note-app-select-wrap {
          padding: 8px 12px;
        }
        .note-app-select {
          min-height: 36px;
          font-size: 12px;
          padding: 0 10px;
        }
        .note-app-meta {
          padding: 8px 12px;
        }
        .note-sidebar textarea {
          min-height: 160px;
          padding: 12px;
        }
        .note-sidebar-foot {
          padding: 8px 12px;
        }
        .filter-panel-head {
          padding: 10px 12px;
        }
        .filter-panel-body {
          padding: 8px 12px 12px;
        }
        .filter-panel-head h2 {
          font-size: 1rem;
        }
        .filter-panel-head button {
          min-height: 34px;
          padding: 6px 9px;
          font-size: 12px;
        }
      }
      @media (max-width: 560px) {
        .top-left {
          gap: 6px;
        }
        .search-toggle-btn {
          width: 34px;
          height: 34px;
          font-size: 15px;
        }
        .top.is-search-open .search-fixed input[type="search"] {
          width: min(250px, 62vw);
          min-width: 120px;
          padding: 8px 10px;
        }
        .top-controls button {
          min-height: 34px;
          font-size: 12px;
          padding: 6px 10px;
        }
        .raw-pagination {
          width: 100%;
          min-width: 0;
          flex: 1 1 100%;
        }
        .filter-summary {
          min-width: 0;
          width: auto;
          justify-content: flex-start;
        }
        .raw-total-count {
          font-size: 11px;
          min-width: 80px;
        }
        .raw-page-info {
          min-width: 44px;
        }
        .note-app-select {
          min-height: 34px;
          font-size: 12px;
          padding: 0 9px;
        }
      }
      @media (min-width: 900px) {
        .cards { grid-template-columns: 1fr 1fr; }
      }
    </style>
  </head>
  <body data-owner-app-id=\"${escapeHtml(ownerAppId)}\">
    <div class=\"top\">
      <div class=\"top-inner top-main\">
        <div class=\"top-left\">
          <a class=\"home-link\" href=\"/\" aria-label=\"홈\" title=\"홈\">🏠</a>
          ${ownerAppIdentityHtml}
          <div class=\"tabs\">
            <button id=\"tabRaw\" class=\"tab-btn active\" type=\"button\">리뷰</button>
            <button id=\"tabBacklog\" class=\"tab-btn\" type=\"button\">리포트</button>
          </div>
        </div>
        <div class=\"search-fixed\">
          <input id=\"search\" type=\"search\" placeholder=\"검색 (앱명, 기능요청, 키워드, 원문)\" />
          <button id=\"openSearchInput\" class=\"search-toggle-btn\" type=\"button\" aria-label=\"검색 열기\" title=\"검색\">🔎</button>
        </div>
        <div class=\"top-controls\">
          <button id=\"openNoteSidebar\" type=\"button\">노트</button>
          <button id=\"openFilterPanel\" class=\"open-filter-panel-btn\" type=\"button\">필터</button>
          <button id=\"toggleEvidenceAll\" type=\"button\">근거 펼치기</button>
          <div id=\"priorityFilter\" class=\"priority-filter hidden-control\" role=\"group\" aria-label=\"우선순위 필터\">
            <button type=\"button\" class=\"priority-filter-btn is-active\" data-priority-filter=\"all\">전체</button>
            <button type=\"button\" class=\"priority-filter-btn\" data-priority-filter=\"must\">MUST</button>
            <button type=\"button\" class=\"priority-filter-btn\" data-priority-filter=\"should\">SHOULD</button>
            <button type=\"button\" class=\"priority-filter-btn\" data-priority-filter=\"could\">COULD</button>
          </div>
        </div>
      </div>
      <div class=\"top-inner top-status-row\">
        <div id=\"activeFilterChips\" class=\"active-filter-chips\"></div>
        <p id=\"filterSummary\" class=\"filter-summary page-filter-summary\">리뷰 0/0 표시</p>
        <div id=\"rawPagination\" class=\"raw-pagination\">
          <span id=\"rawTotalCount\" class=\"raw-total-count\">리뷰 0/0</span>
          <button id=\"rawPagePrev\" type=\"button\">이전</button>
          <span id=\"rawPageInfo\" class=\"raw-page-info\">1/1</span>
          <button id=\"rawPageNext\" type=\"button\">다음</button>
        </div>
      </div>
    </div>

    <main class=\"wrap\" id=\"root\">
      <h1>${escapeHtml(reportTitle)}</h1>
      <section id=\"contextRaw\" class=\"context-panel active\">
        ${rawSummaryHtml}
      </section>
      <section id=\"contextBacklog\" class=\"context-panel\">
        ${backlogSummaryHtml}
      </section>

      <section id=\"viewRaw\" class=\"view active\">
        ${rawAppSections}
      </section>

      <section id=\"viewBacklog\" class=\"view\">
        ${backlogSections}
      </section>
    </main>

    <div id=\"noteSidebarRoot\" class=\"note-sidebar-root\" hidden aria-hidden=\"true\">
      <button id=\"noteSidebarBackdrop\" class=\"note-sidebar-backdrop\" type=\"button\" aria-label=\"노트 닫기\"></button>
      <aside class=\"note-sidebar\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"noteSidebarTitle\">
        <div class=\"note-sidebar-head\">
          <div>
            <h2 id=\"noteSidebarTitle\">앱 노트</h2>
            <div id=\"noteSidebarSub\" class=\"note-sidebar-sub\">셀렉터에서 앱을 선택해 메모를 관리하세요.</div>
          </div>
          <div class=\"note-sidebar-head-actions\">
            <button id=\"noteSidebarSave\" type=\"button\">저장</button>
            <button id=\"noteSidebarClose\" type=\"button\">닫기</button>
          </div>
        </div>
        <div class=\"note-app-select-wrap\">
          <select id=\"noteAppSelect\" class=\"note-app-select\" aria-label=\"노트 앱 선택\">
            ${appNoteSelectOptionsHtml}
          </select>
        </div>
        <div class=\"note-app-meta\">
          <div id=\"noteSidebarAppLinks\" class=\"note-app-links\"></div>
        </div>
        <textarea id=\"noteSidebarText\" placeholder=\"예) 반복 불만 키워드, 다음 비교 포인트, 액션 아이템\"></textarea>
        <div id=\"noteSidebarStatus\" class=\"note-sidebar-foot\">변경 후 저장 버튼을 눌러 반영하세요.</div>
      </aside>
    </div>

    <div id=\"filterPanelRoot\" class=\"filter-panel-root\" hidden aria-hidden=\"true\">
      <button id=\"filterPanelBackdrop\" class=\"filter-panel-backdrop\" type=\"button\" aria-label=\"필터 닫기\"></button>
      <aside class=\"filter-panel\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"filterPanelTitle\">
        <div class=\"filter-panel-head\">
          <div class=\"filter-panel-head-top\">
            <h2 id=\"filterPanelTitle\">리뷰 필터</h2>
            <div class=\"filter-panel-head-actions\">
              <button id=\"clearFilters\" class=\"filter-panel-icon-btn\" type=\"button\" aria-label=\"필터 초기화\" title=\"초기화\">↻</button>
              <button id=\"filterPanelClose\" type=\"button\">닫기</button>
            </div>
          </div>
          <p id=\"filterPanelCount\" class=\"filter-summary filter-panel-summary\">리뷰 0/0</p>
        </div>
        <div id=\"topFiltersLeft\" class=\"filter-panel-body\">
          <div class=\"filter-field\">
            <label class=\"toggle-all-label\"><input id=\"toggleAll\" type=\"checkbox\" /> 원어 보기</label>
          </div>
          <div class=\"filter-field\">
            <p class=\"filter-field-title\">해시태그</p>
            <div id=\"tagFilter\" class=\"tag-filter\" role=\"group\" aria-label=\"해시태그 필터\">
              <button type=\"button\" class=\"tag-filter-btn is-active\" data-tag-filter=\"all\">태그 전체</button>
              <button type=\"button\" class=\"tag-filter-btn\" data-tag-filter=\"heart\">#❤️</button>
              <button type=\"button\" class=\"tag-filter-btn\" data-tag-filter=\"satisfaction\">#만족</button>
              <button type=\"button\" class=\"tag-filter-btn\" data-tag-filter=\"dissatisfaction\">#불만족</button>
              <button type=\"button\" class=\"tag-filter-btn\" data-tag-filter=\"requests\">#요청기능</button>
            </div>
          </div>
          <div class=\"filter-field\">
            <label class=\"toggle-length-label\"><input id=\"minLength100\" type=\"checkbox\" /> 100자 이상</label>
          </div>
          <div class=\"filter-field\">
            <p class=\"filter-field-title\">활성 상태</p>
            <div id=\"excludeFilter\" class=\"exclude-filter\" role=\"group\" aria-label=\"활성 상태 필터\">
              <button type=\"button\" class=\"exclude-filter-btn is-active\" data-exclude-filter=\"all\">전체</button>
              <button type=\"button\" class=\"exclude-filter-btn\" data-exclude-filter=\"active\">활성</button>
              <button type=\"button\" class=\"exclude-filter-btn\" data-exclude-filter=\"excluded\">비활성</button>
            </div>
          </div>
          <div class=\"filter-panel-foot\">
            <button id=\"resetAllExcluded\" class=\"clear-filters-btn bulk-exclude-btn\" type=\"button\">전체 리뷰 비활성 리셋</button>
          </div>
        </div>
      </aside>
    </div>

    <script>
      const topBar = document.querySelector('.top');
      const root = document.getElementById('root');
      const searchInput = document.getElementById('search');
      const openSearchInputButton = document.getElementById('openSearchInput');
      const searchFixed = document.querySelector('.search-fixed');
      const topStatusRow = document.querySelector('.top-status-row');
      const openFilterPanelButton = document.getElementById('openFilterPanel');
      const toggleAll = document.getElementById('toggleAll');
      const tagFilter = document.getElementById('tagFilter');
      const tagFilterButtons = tagFilter
        ? Array.from(tagFilter.querySelectorAll('[data-tag-filter]'))
        : [];
      const clearFiltersButton = document.getElementById('clearFilters');
      const resetAllExcludedButton = document.getElementById('resetAllExcluded');
      const minLength100 = document.getElementById('minLength100');
      const excludeFilter = document.getElementById('excludeFilter');
      const filterSummary = document.getElementById('filterSummary');
      const filterPanelCount = document.getElementById('filterPanelCount');
      const activeFilterChips = document.getElementById('activeFilterChips');
      const rawPagination = document.getElementById('rawPagination');
      const rawTotalCount = document.getElementById('rawTotalCount');
      const rawPagePrev = document.getElementById('rawPagePrev');
      const rawPageNext = document.getElementById('rawPageNext');
      const rawPageInfo = document.getElementById('rawPageInfo');
      const priorityFilter = document.getElementById('priorityFilter');
      const priorityFilterButtons = priorityFilter
        ? Array.from(priorityFilter.querySelectorAll('[data-priority-filter]'))
        : [];
      const excludeFilterButtons = excludeFilter
        ? Array.from(excludeFilter.querySelectorAll('[data-exclude-filter]'))
        : [];
      const toggleEvidenceAll = document.getElementById('toggleEvidenceAll');
      const openNoteSidebarButton = document.getElementById('openNoteSidebar');
      const tabRaw = document.getElementById('tabRaw');
      const tabBacklog = document.getElementById('tabBacklog');
      const viewRaw = document.getElementById('viewRaw');
      const viewBacklog = document.getElementById('viewBacklog');
      const contextRaw = document.getElementById('contextRaw');
      const contextBacklog = document.getElementById('contextBacklog');
      const rawCards = Array.from(viewRaw.querySelectorAll('.quote-card[data-review-id]'));
      const rawAppSections = Array.from(viewRaw.querySelectorAll('.app[data-app-key]'));
      const rawAppSectionCards = rawAppSections.map((section) => ({
        section,
        cards: Array.from(section.querySelectorAll('.quote-card[data-review-id]')),
        countLabel: section.querySelector('.app-count')
      }));
      const backlogItems = Array.from(viewBacklog.querySelectorAll('.backlog-item'));
      const noteSidebarRoot = document.getElementById('noteSidebarRoot');
      const noteSidebarBackdrop = document.getElementById('noteSidebarBackdrop');
      const noteSidebarClose = document.getElementById('noteSidebarClose');
      const noteSidebarSave = document.getElementById('noteSidebarSave');
      const noteSidebarTitle = document.getElementById('noteSidebarTitle');
      const noteSidebarSub = document.getElementById('noteSidebarSub');
      const noteSidebarAppLinks = document.getElementById('noteSidebarAppLinks');
      const noteAppSelect = document.getElementById('noteAppSelect');
      const noteSidebarText = document.getElementById('noteSidebarText');
      const noteSidebarStatus = document.getElementById('noteSidebarStatus');
      const filterPanelRoot = document.getElementById('filterPanelRoot');
      const filterPanelBackdrop = document.getElementById('filterPanelBackdrop');
      const filterPanelClose = document.getElementById('filterPanelClose');
      const reviewState = Object.create(null);
      const appNotes = Object.create(null);
      const persistedAppNotes = Object.create(null);
      const noteAppCatalog = ${appNoteAppsJson};
      const noteAppByKey = new Map(noteAppCatalog.map((item) => [item.appKey, item]));
      const defaultNoteAppKey = noteAppCatalog[0] ? noteAppCatalog[0].appKey : '';
      const searchableTextCache = new WeakMap();
      let saveStateTimer = null;
      let searchApplyRaf = 0;
      let filterPanelCloseTimer = 0;
      let noteSidebarCloseTimer = 0;
      let stateLoaded = false;
      let rawPageSize = 100;
      let rawCurrentPage = 1;
      let rawFilteredCount = rawCards.length;
      let rawTotalPages = 1;
      let excludeFilterMode = 'all';
      let backlogPriorityFilterMode = 'all';
      let noteDirty = false;
      const selectedTagFilters = new Set();
      let activeNoteAppKey = '';
      const EXCLUDE_FILTER_MODES = new Set(['all', 'active', 'excluded']);
      const PRIORITY_FILTER_MODES = new Set(['all', 'must', 'should', 'could']);
      const REVIEW_TAGS = ['heart', 'satisfaction', 'dissatisfaction', 'requests'];
      const TAG_FILTER_MODES = new Set(['all', 'heart', 'satisfaction', 'dissatisfaction', 'requests']);
      const TAB_QUERY_KEY = 'tab';
      const SEARCH_QUERY_KEY = 'q';
      const TAGS_QUERY_KEY = 'tags';
      const EXCLUDE_QUERY_KEY = 'exclude';
      const MIN_LENGTH_QUERY_KEY = 'min100';
      const SHOW_ORIGINAL_QUERY_KEY = 'orig';
      const RAW_PAGE_QUERY_KEY = 'page';
      const PRIORITY_QUERY_KEY = 'priority';
      const TAB_REVIEW_VALUES = new Set(['reviews', 'review', 'raw']);
      const TAB_REPORT_VALUES = new Set(['reports', 'report', 'backlog']);
      const TAG_LABELS = {
        heart: '❤️',
        satisfaction: '만족',
        dissatisfaction: '불만족',
        requests: '요청기능'
      };

      function escapeInlineHtml(input) {
        return String(input || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function resolveOwnerAppId() {
        const fromBody = (document.body && document.body.getAttribute('data-owner-app-id')) || '';
        const trimmedBody = fromBody.trim();
        if (trimmedBody) {
          return trimmedBody;
        }

        const pathname = String(window.location.pathname || '');
        const segments = pathname.split('/').filter((item) => item.length > 0);
        if (segments.length < 2 || segments[0] !== 'r') {
          return '';
        }

        try {
          return decodeURIComponent(segments[1]);
        } catch {
          return segments[1];
        }
      }

      const ownerAppId = resolveOwnerAppId();
      const previewStateApiUrl = ownerAppId ? '/api/preview-state/' + encodeURIComponent(ownerAppId) : '';

      function normalizeTag(input) {
        const tag = String(input || '').trim().toLowerCase();
        return REVIEW_TAGS.includes(tag) ? tag : '';
      }

      function normalizeTagList(input) {
        const source = Array.isArray(input) ? input : [];
        const bucket = new Set();

        source.forEach((item) => {
          const tag = normalizeTag(item);
          if (tag) {
            bucket.add(tag);
          }
        });

        return REVIEW_TAGS.filter((tag) => bucket.has(tag));
      }

      function sameTagList(a, b) {
        if (a.length !== b.length) {
          return false;
        }
        return a.every((item, index) => item === b[index]);
      }

      function getSearchQuery() {
        return searchInput instanceof HTMLInputElement ? searchInput.value.trim().toLowerCase() : '';
      }

      function parseQueryBoolean(input) {
        const normalized = String(input || '').trim().toLowerCase();
        return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
      }

      function parsePageNumber(input) {
        const parsed = Number.parseInt(String(input || ''), 10);
        if (!Number.isFinite(parsed) || parsed < 1) {
          return 1;
        }
        return parsed;
      }

      function resolveUiStateFromQuery() {
        const initial = {
          rawTab: true,
          search: '',
          tags: [],
          excludeMode: 'all',
          minLength100: false,
          showOriginal: false,
          rawPage: 1,
          backlogPriorityMode: 'all'
        };

        try {
          const params = new URLSearchParams(window.location.search || '');
          const tabValue = String(params.get(TAB_QUERY_KEY) || '').trim().toLowerCase();
          if (TAB_REPORT_VALUES.has(tabValue)) {
            initial.rawTab = false;
          } else if (TAB_REVIEW_VALUES.has(tabValue)) {
            initial.rawTab = true;
          }

          const search = String(params.get(SEARCH_QUERY_KEY) || '').trim();
          initial.search = search;

          const tagValues = String(params.get(TAGS_QUERY_KEY) || '')
            .split(',')
            .map((item) => normalizeTag(item))
            .filter(Boolean);
          initial.tags = normalizeTagList(tagValues);

          const excludeMode = String(params.get(EXCLUDE_QUERY_KEY) || '').trim().toLowerCase();
          initial.excludeMode = EXCLUDE_FILTER_MODES.has(excludeMode) ? excludeMode : 'all';

          initial.minLength100 = parseQueryBoolean(params.get(MIN_LENGTH_QUERY_KEY));
          initial.showOriginal = parseQueryBoolean(params.get(SHOW_ORIGINAL_QUERY_KEY));
          initial.rawPage = parsePageNumber(params.get(RAW_PAGE_QUERY_KEY));

          const priorityMode = String(params.get(PRIORITY_QUERY_KEY) || '').trim().toLowerCase();
          initial.backlogPriorityMode = PRIORITY_FILTER_MODES.has(priorityMode) ? priorityMode : 'all';
        } catch {}

        return initial;
      }

      function syncUiQuery() {
        if (!window.history || typeof window.history.replaceState !== 'function') {
          return;
        }

        try {
          const url = new URL(window.location.href);
          const nextParams = new URLSearchParams(url.searchParams.toString());
          const activeRawTab = viewRaw.classList.contains('active');
          const search = searchInput instanceof HTMLInputElement ? searchInput.value.trim() : '';
          const tags = normalizeTagList(Array.from(selectedTagFilters));
          const excludeMode = EXCLUDE_FILTER_MODES.has(excludeFilterMode) ? excludeFilterMode : 'all';
          const minLengthEnabled = minLength100 instanceof HTMLInputElement && minLength100.checked;
          const showOriginal = toggleAll instanceof HTMLInputElement && toggleAll.checked;
          const rawPage = parsePageNumber(rawCurrentPage);
          const priorityMode = PRIORITY_FILTER_MODES.has(backlogPriorityFilterMode)
            ? backlogPriorityFilterMode
            : 'all';

          nextParams.set(TAB_QUERY_KEY, activeRawTab ? 'reviews' : 'reports');

          if (search) {
            nextParams.set(SEARCH_QUERY_KEY, search);
          } else {
            nextParams.delete(SEARCH_QUERY_KEY);
          }

          if (tags.length > 0) {
            nextParams.set(TAGS_QUERY_KEY, tags.join(','));
          } else {
            nextParams.delete(TAGS_QUERY_KEY);
          }

          if (excludeMode !== 'all') {
            nextParams.set(EXCLUDE_QUERY_KEY, excludeMode);
          } else {
            nextParams.delete(EXCLUDE_QUERY_KEY);
          }

          if (minLengthEnabled) {
            nextParams.set(MIN_LENGTH_QUERY_KEY, '1');
          } else {
            nextParams.delete(MIN_LENGTH_QUERY_KEY);
          }

          if (showOriginal) {
            nextParams.set(SHOW_ORIGINAL_QUERY_KEY, '1');
          } else {
            nextParams.delete(SHOW_ORIGINAL_QUERY_KEY);
          }

          if (rawPage > 1) {
            nextParams.set(RAW_PAGE_QUERY_KEY, String(rawPage));
          } else {
            nextParams.delete(RAW_PAGE_QUERY_KEY);
          }

          if (priorityMode !== 'all') {
            nextParams.set(PRIORITY_QUERY_KEY, priorityMode);
          } else {
            nextParams.delete(PRIORITY_QUERY_KEY);
          }

          const currentSearch = url.searchParams.toString();
          const nextSearch = nextParams.toString();
          if (currentSearch === nextSearch) {
            return;
          }

          const nextUrl = url.pathname + (nextSearch ? '?' + nextSearch : '') + url.hash;
          window.history.replaceState(null, '', nextUrl);
        } catch {}
      }

      function getSearchableText(el) {
        if (!el) {
          return '';
        }
        if (searchableTextCache.has(el)) {
          return searchableTextCache.get(el);
        }
        const text = String(el.getAttribute('data-search') || '').toLowerCase();
        searchableTextCache.set(el, text);
        return text;
      }

      function getCardReviewId(card) {
        return (card && card.getAttribute && card.getAttribute('data-review-id') || '').trim();
      }

      function isCardDefaultExcluded(card) {
        const raw = (card && card.getAttribute && card.getAttribute('data-default-excluded') || '').trim().toLowerCase();
        return raw === 'true' || raw === '1' || raw === 'yes';
      }

      function getCardDefaultTags(card) {
        const raw = (card && card.getAttribute && card.getAttribute('data-default-tags') || '').trim();
        if (!raw) {
          return [];
        }
        return normalizeTagList(raw.split(','));
      }

      function readCardState(reviewId, card) {
        const defaultExcluded = isCardDefaultExcluded(card);
        const defaultTags = getCardDefaultTags(card);
        const row = reviewState[reviewId];
        if (!row || typeof row !== 'object') {
          return { tags: defaultTags, excluded: defaultExcluded };
        }

        const hasExplicitTags = Object.prototype.hasOwnProperty.call(row, 'tags') && Array.isArray(row.tags);
        const tags = hasExplicitTags ? normalizeTagList(row.tags) : defaultTags;

        return {
          tags,
          excluded: Boolean(row.excluded)
        };
      }

      function writeCardState(reviewId, next, card) {
        const defaultExcluded = isCardDefaultExcluded(card);
        const defaultTags = getCardDefaultTags(card);
        const cleaned = {
          tags: normalizeTagList(next.tags),
          excluded: Boolean(next.excluded),
          updatedAt: new Date().toISOString()
        };

        if (cleaned.excluded === defaultExcluded && sameTagList(cleaned.tags, defaultTags)) {
          delete reviewState[reviewId];
          return;
        }

        reviewState[reviewId] = {
          tags: cleaned.tags,
          excluded: cleaned.excluded,
          updatedAt: cleaned.updatedAt
        };
      }

      function syncCardStateVisual(card) {
        const reviewId = getCardReviewId(card);
        if (!reviewId) {
          return;
        }

        const state = readCardState(reviewId, card);
        card.classList.toggle('has-heart-tag', state.tags.includes('heart'));
        card.classList.toggle('has-satisfaction-tag', state.tags.includes('satisfaction'));
        card.classList.toggle('has-dissatisfaction-tag', state.tags.includes('dissatisfaction'));
        card.classList.toggle('has-requests-tag', state.tags.includes('requests'));
        card.classList.toggle('is-excluded', state.excluded);

        const tagButtons = Array.from(card.querySelectorAll('.tag-toggle[data-tag]'));
        tagButtons.forEach((button) => {
          if (!(button instanceof HTMLElement)) {
            return;
          }

          const tag = normalizeTag(button.getAttribute('data-tag'));
          if (!tag) {
            return;
          }

          const active = state.tags.includes(tag);
          const blockedByInactive = state.excluded;
          button.classList.toggle('is-active', active);
          button.setAttribute('aria-pressed', active ? 'true' : 'false');
          button.toggleAttribute('disabled', blockedByInactive);
          button.setAttribute(
            'title',
            blockedByInactive
              ? '활성 상태에서만 해시태그를 변경할 수 있습니다.'
              : active
                ? '#' + TAG_LABELS[tag] + ' 해제'
                : '#' + TAG_LABELS[tag] + ' 추가'
          );
        });

        const excludeButton = card.querySelector('.exclude-toggle');
        if (excludeButton instanceof HTMLElement) {
          excludeButton.classList.toggle('is-active', state.excluded);
          excludeButton.textContent = state.excluded ? '비활성' : '활성';
          excludeButton.setAttribute('aria-label', state.excluded ? '현재 비활성, 클릭하면 활성' : '현재 활성, 클릭하면 비활성');
          excludeButton.setAttribute('title', state.excluded ? '현재 비활성, 클릭하면 활성' : '현재 활성, 클릭하면 비활성');
        }

        syncOriginalToggleButton(card);
      }

      function syncOriginalToggleButton(card) {
        const toggleOne = card && card.querySelector ? card.querySelector('.toggle-one') : null;
        if (!(toggleOne instanceof HTMLElement)) {
          return;
        }

        const opened = card.classList.contains('show-one-original');
        toggleOne.setAttribute('aria-pressed', opened ? 'true' : 'false');
        toggleOne.setAttribute('aria-label', opened ? '원어 숨기기' : '원어 보기');
        toggleOne.setAttribute('title', opened ? '원어 숨기기' : '원어 보기');

        const icon = toggleOne.querySelector('.toggle-icon');
        if (icon instanceof HTMLElement) {
          icon.textContent = '▾';
        }
      }

      function syncAllCardStateVisuals() {
        rawCards.forEach((card) => {
          syncCardStateVisual(card);
        });
      }

      function setExcludeFilterMode(nextMode) {
        excludeFilterMode = EXCLUDE_FILTER_MODES.has(nextMode) ? nextMode : 'all';

        excludeFilterButtons.forEach((button) => {
          if (!(button instanceof HTMLElement)) {
            return;
          }

          const mode = (button.getAttribute('data-exclude-filter') || '').trim();
          button.classList.toggle('is-active', mode === excludeFilterMode);
        });
      }

      function setTagFilterMode(nextMode) {
        const mode = TAG_FILTER_MODES.has(nextMode) ? nextMode : 'all';
        if (mode === 'all') {
          selectedTagFilters.clear();
        } else if (selectedTagFilters.has(mode)) {
          selectedTagFilters.delete(mode);
        } else {
          selectedTagFilters.add(mode);
        }
        syncTagFilterButtons();
      }

      function syncTagFilterButtons() {
        const hasTagFilters = selectedTagFilters.size > 0;
        tagFilterButtons.forEach((button) => {
          if (!(button instanceof HTMLElement)) {
            return;
          }

          const mode = (button.getAttribute('data-tag-filter') || '').trim();
          if (mode === 'all') {
            button.classList.toggle('is-active', !hasTagFilters);
            return;
          }
          button.classList.toggle('is-active', selectedTagFilters.has(mode));
        });
      }

      function setBacklogPriorityFilterMode(mode) {
        const normalized = String(mode || '').trim().toLowerCase();
        backlogPriorityFilterMode = PRIORITY_FILTER_MODES.has(normalized) ? normalized : 'all';
        syncPriorityFilterButtons();
      }

      function syncPriorityFilterButtons() {
        priorityFilterButtons.forEach((button) => {
          if (!(button instanceof HTMLElement)) {
            return;
          }

          const mode = (button.getAttribute('data-priority-filter') || '').trim().toLowerCase();
          button.classList.toggle('is-active', mode === backlogPriorityFilterMode);
        });
      }

      function syncActiveFilterChips() {
        if (!(activeFilterChips instanceof HTMLElement)) {
          return;
        }

        if (!viewRaw.classList.contains('active')) {
          activeFilterChips.innerHTML = '';
          return;
        }

        const chips = [];
        const query = searchInput instanceof HTMLInputElement ? searchInput.value.trim() : '';
        if (query) {
          chips.push('검색: ' + query);
        }
        selectedTagFilters.forEach((tag) => {
          chips.push('#' + TAG_LABELS[tag]);
        });
        if (excludeFilterMode === 'active') {
          chips.push('상태: 활성');
        } else if (excludeFilterMode === 'excluded') {
          chips.push('상태: 비활성');
        }
        if (minLength100 instanceof HTMLInputElement && minLength100.checked) {
          chips.push('100자 이상');
        }

        if (!chips.length) {
          activeFilterChips.innerHTML = '<span class=\"active-filter-chip\">필터 없음</span>';
          return;
        }

        activeFilterChips.innerHTML = chips
          .map((text) => '<span class=\"active-filter-chip\">' + escapeInlineHtml(text) + '</span>')
          .join('');
      }

      function countActiveRawFilters() {
        let count = 0;
        const query = searchInput instanceof HTMLInputElement ? searchInput.value.trim() : '';
        if (query) {
          count += 1;
        }
        count += selectedTagFilters.size;
        if (excludeFilterMode !== 'all') {
          count += 1;
        }
        if (minLength100 instanceof HTMLInputElement && minLength100.checked) {
          count += 1;
        }
        return count;
      }

      function syncFilterPanelTrigger() {
        if (!(openFilterPanelButton instanceof HTMLElement)) {
          return;
        }

        const activeCount = viewRaw.classList.contains('active') ? countActiveRawFilters() : 0;
        openFilterPanelButton.textContent = activeCount > 0 ? '필터 (' + activeCount + ')' : '필터';
        openFilterPanelButton.classList.toggle('is-active', activeCount > 0);
      }

      function syncRawPaginationUi() {
        if (!(rawPagination instanceof HTMLElement)) {
          return;
        }

        const multiPage = rawTotalPages > 1;
        rawPagination.classList.toggle('hidden-control', !viewRaw.classList.contains('active'));

        if (rawTotalCount instanceof HTMLElement) {
          rawTotalCount.textContent = '리뷰 ' + rawFilteredCount + '/' + rawCards.length;
        }
        if (filterPanelCount instanceof HTMLElement) {
          filterPanelCount.textContent = '리뷰 ' + rawFilteredCount + '/' + rawCards.length;
        }

        if (rawPageInfo instanceof HTMLElement) {
          rawPageInfo.textContent = rawCurrentPage + '/' + rawTotalPages;
        }
        if (rawPagePrev instanceof HTMLButtonElement) {
          rawPagePrev.disabled = !multiPage || rawCurrentPage <= 1;
        }
        if (rawPageNext instanceof HTMLButtonElement) {
          rawPageNext.disabled = !multiPage || rawCurrentPage >= rawTotalPages;
        }
      }

      function syncRawSectionVisibility() {
        rawAppSectionCards.forEach((entry) => {
          const filteredCount = entry.cards.reduce((count, card) => {
            const matchedBySearch = !card.classList.contains('hidden-by-search');
            const matchedByState = !card.classList.contains('hidden-by-state');
            return matchedBySearch && matchedByState ? count + 1 : count;
          }, 0);
          if (entry.countLabel instanceof HTMLElement) {
            entry.countLabel.textContent = '리뷰 ' + filteredCount + '/' + entry.cards.length;
          }

          const hasVisible = entry.cards.some(
            (card) =>
              !card.classList.contains('hidden-by-search') &&
              !card.classList.contains('hidden-by-state') &&
              !card.classList.contains('hidden-by-page')
          );
          entry.section.classList.toggle('hidden-by-page', !hasVisible);
        });
      }

      function applyRawPagination() {
        const filteredCards = rawCards.filter(
          (card) => !card.classList.contains('hidden-by-search') && !card.classList.contains('hidden-by-state')
        );
        rawFilteredCount = filteredCards.length;
        rawTotalPages = Math.max(1, Math.ceil(rawFilteredCount / rawPageSize));
        rawCurrentPage = Math.max(1, Math.min(rawCurrentPage, rawTotalPages));

        const startIndex = (rawCurrentPage - 1) * rawPageSize;
        const endIndex = startIndex + rawPageSize;
        rawCards.forEach((card) => {
          card.classList.add('hidden-by-page');
        });
        for (let index = startIndex; index < endIndex && index < filteredCards.length; index += 1) {
          filteredCards[index].classList.remove('hidden-by-page');
        }

        syncRawSectionVisibility();
        syncRawPaginationUi();
      }

      function setSearchExpanded(nextExpanded) {
        if (!(topBar instanceof HTMLElement)) {
          return;
        }

        const shouldOpen = Boolean(nextExpanded);
        topBar.classList.toggle('is-search-open', shouldOpen);
        if (openSearchInputButton instanceof HTMLElement) {
          openSearchInputButton.setAttribute('aria-label', shouldOpen ? '검색 닫기' : '검색 열기');
          openSearchInputButton.setAttribute('title', shouldOpen ? '검색 닫기' : '검색');
        }
      }

      function closeFilterPanel() {
        if (filterPanelRoot instanceof HTMLElement) {
          filterPanelRoot.classList.remove('is-open');
          if (filterPanelCloseTimer) {
            window.clearTimeout(filterPanelCloseTimer);
          }
          filterPanelCloseTimer = window.setTimeout(() => {
            filterPanelRoot.hidden = true;
            filterPanelRoot.setAttribute('aria-hidden', 'true');
          }, 180);
        }
      }

      function openFilterPanel() {
        if (!viewRaw.classList.contains('active')) {
          return;
        }
        if (filterPanelRoot instanceof HTMLElement) {
          if (filterPanelCloseTimer) {
            window.clearTimeout(filterPanelCloseTimer);
          }
          filterPanelRoot.hidden = false;
          filterPanelRoot.setAttribute('aria-hidden', 'false');
          window.requestAnimationFrame(() => {
            filterPanelRoot.classList.add('is-open');
          });
        }
        if (filterPanelClose instanceof HTMLElement) {
          window.setTimeout(() => filterPanelClose.focus(), 0);
        }
      }

      function syncFilterSummary() {
        if (!(filterSummary instanceof HTMLElement)) {
          return;
        }

        filterSummary.classList.add('hidden-control');

        if (viewRaw.classList.contains('active')) {
          syncActiveFilterChips();
          syncFilterPanelTrigger();
          syncRawPaginationUi();
          return;
        }

        syncActiveFilterChips();
        syncFilterPanelTrigger();
        syncRawPaginationUi();
      }

      function resetRawFilters() {
        if (searchInput instanceof HTMLInputElement) {
          searchInput.value = '';
        }
        if (toggleAll instanceof HTMLInputElement) {
          toggleAll.checked = false;
        }
        if (minLength100 instanceof HTMLInputElement) {
          minLength100.checked = false;
        }
        document.body.classList.remove('show-all-original');
        selectedTagFilters.clear();
        syncTagFilterButtons();
        setExcludeFilterMode('all');
        rawCurrentPage = 1;
        applySearch();
      }

      function resetAllReviewsToExcluded() {
        if (rawCards.length === 0) {
          return;
        }

        const confirmed = window.confirm('모든 리뷰를 비활성으로 변경하고 해시태그를 초기화할까요?');
        if (!confirmed) {
          return;
        }

        rawCards.forEach((card) => {
          const reviewId = getCardReviewId(card);
          if (!reviewId) {
            return;
          }

          const state = readCardState(reviewId, card);
          state.excluded = true;
          state.tags = [];
          writeCardState(reviewId, state, card);
          syncCardStateVisual(card);
        });

        rawCurrentPage = 1;
        applySearch();
        schedulePreviewStateSave();
      }

      function applyRawStateFilters(searchQuery) {
        const minLengthChecked = minLength100 instanceof HTMLInputElement && minLength100.checked;
        const query = String(searchQuery || '');

        rawCards.forEach((card) => {
          const reviewId = getCardReviewId(card);
          if (!reviewId) {
            return;
          }

          const state = readCardState(reviewId, card);
          const textLength = Number(card.getAttribute('data-text-length') || '0');
          const hideByTag =
            selectedTagFilters.size > 0 && !state.tags.some((tag) => selectedTagFilters.has(tag));
          const hideByLength = minLengthChecked && textLength < 100;
          const hideByExcluded =
            (excludeFilterMode === 'active' && state.excluded) ||
            (excludeFilterMode === 'excluded' && !state.excluded);
          const hideBySearch = query.length > 0 && !getSearchableText(card).includes(query);
          card.classList.toggle('hidden-by-search', hideBySearch);
          card.classList.toggle('hidden-by-state', hideByTag || hideByLength || hideByExcluded);
        });
      }

      function normalizeNoteContent(input) {
        return String(input || '').replace(/\\r\\n?/g, '\\n').replace(/\\u0000/g, '').slice(0, 20000);
      }

      function formatDateLabel(input) {
        const date = new Date(String(input || ''));
        if (Number.isNaN(date.getTime())) {
          return '-';
        }
        return date.toLocaleString('ko-KR');
      }

      function copyAppNotesMap(target, source) {
        Object.keys(target).forEach((key) => {
          delete target[key];
        });

        Object.entries(source).forEach(([appKey, row]) => {
          if (!appKey || !row || typeof row !== 'object') {
            return;
          }

          const content = normalizeNoteContent(typeof row.content === 'string' ? row.content : '');
          if (!content.trim()) {
            return;
          }

          target[appKey] = {
            content,
            updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString()
          };
        });
      }

      function normalizeAppNotesSnapshot(source) {
        const snapshot = Object.create(null);

        Object.entries(source).forEach(([appKey, row]) => {
          if (!appKey || !row || typeof row !== 'object') {
            return;
          }

          const content = normalizeNoteContent(typeof row.content === 'string' ? row.content : '');
          if (!content.trim()) {
            return;
          }

          snapshot[appKey] = {
            content,
            updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString()
          };
        });

        return snapshot;
      }

      function createAppNotesSignature(source) {
        const snapshot = normalizeAppNotesSnapshot(source);
        const keys = Object.keys(snapshot).sort();
        return keys
          .map((key) => {
            const row = snapshot[key];
            return key + '|' + row.content + '|' + row.updatedAt;
          })
          .join('||');
      }

      function syncNoteDirtyState() {
        noteDirty = createAppNotesSignature(appNotes) !== createAppNotesSignature(persistedAppNotes);
      }

      function syncNoteSidebarTrigger() {
        if (!(openNoteSidebarButton instanceof HTMLElement)) {
          return;
        }

        const noteCount = Object.keys(normalizeAppNotesSnapshot(appNotes)).length;
        openNoteSidebarButton.textContent = noteCount > 0 ? '노트 (' + noteCount + ')' : '노트';
        openNoteSidebarButton.classList.toggle('is-active', noteCount > 0 || noteDirty);
      }

      function syncNoteAppSelect() {
        if (!(noteAppSelect instanceof HTMLSelectElement)) {
          return;
        }
        if (activeNoteAppKey && noteAppSelect.value !== activeNoteAppKey) {
          noteAppSelect.value = activeNoteAppKey;
        }
      }

      function renderNoteAppLinks(appKey) {
        const appMeta = noteAppByKey.get(String(appKey || '').trim());
        if (!(noteSidebarAppLinks instanceof HTMLElement)) {
          return;
        }

        if (!appMeta || !Array.isArray(appMeta.links) || appMeta.links.length === 0) {
          noteSidebarAppLinks.innerHTML = '<span class=\"note-link-empty\">스토어 링크 없음</span>';
          return;
        }

        noteSidebarAppLinks.innerHTML = appMeta.links
          .map(
            (link) =>
              '<a class=\"note-link\" href=\"' +
              escapeInlineHtml(String(link.href || '')) +
              '\" target=\"_blank\" rel=\"noopener noreferrer\">' +
              escapeInlineHtml(String(link.label || 'Link')) +
              '</a>'
          )
          .join('');
      }

      function refreshNoteSidebarStatus() {
        if (!(noteSidebarStatus instanceof HTMLElement)) {
          return;
        }

        if (!activeNoteAppKey) {
          noteSidebarStatus.textContent = '앱을 선택하면 메모를 작성할 수 있습니다.';
          return;
        }

        if (noteDirty) {
          noteSidebarStatus.textContent = '저장되지 않은 변경이 있습니다.';
          return;
        }

        const note = persistedAppNotes[activeNoteAppKey];
        if (!note) {
          noteSidebarStatus.textContent = '저장된 노트가 없습니다.';
          return;
        }

        noteSidebarStatus.textContent = '저장됨 · ' + formatDateLabel(note.updatedAt);
      }

      function selectNoteApp(appKey) {
        const requestedAppKey = String(appKey || '').trim();
        const nextAppKey = noteAppByKey.has(requestedAppKey)
          ? requestedAppKey
          : defaultNoteAppKey;

        activeNoteAppKey = nextAppKey;

        if (noteSidebarTitle instanceof HTMLElement) {
          noteSidebarTitle.textContent = '앱 노트';
        }
        if (noteSidebarSub instanceof HTMLElement) {
          noteSidebarSub.textContent = '셀렉터에서 앱을 선택해 메모를 관리하세요.';
        }
        renderNoteAppLinks(nextAppKey);

        if (noteSidebarText instanceof HTMLTextAreaElement) {
          noteSidebarText.value = appNotes[nextAppKey] ? appNotes[nextAppKey].content : '';
        }

        syncNoteAppSelect();
        refreshNoteSidebarStatus();
      }

      function openAppNoteSidebar() {
        if (!noteAppCatalog.length) {
          return;
        }

        if (noteSidebarRoot instanceof HTMLElement) {
          if (noteSidebarCloseTimer) {
            window.clearTimeout(noteSidebarCloseTimer);
          }
          noteSidebarRoot.hidden = false;
          noteSidebarRoot.setAttribute('aria-hidden', 'false');
          window.requestAnimationFrame(() => {
            noteSidebarRoot.classList.add('is-open');
          });
        }

        selectNoteApp(activeNoteAppKey || defaultNoteAppKey);

        if (noteSidebarText instanceof HTMLTextAreaElement) {
          window.setTimeout(() => noteSidebarText.focus(), 0);
        }
      }

      function closeAppNoteSidebar() {
        if (noteSidebarRoot instanceof HTMLElement) {
          noteSidebarRoot.classList.remove('is-open');
          if (noteSidebarCloseTimer) {
            window.clearTimeout(noteSidebarCloseTimer);
          }
          noteSidebarCloseTimer = window.setTimeout(() => {
            noteSidebarRoot.hidden = true;
            noteSidebarRoot.setAttribute('aria-hidden', 'true');
          }, 180);
        }
      }

      function writeAppNote(appKey, input) {
        const normalizedAppKey = String(appKey || '').trim();
        if (!normalizedAppKey) {
          return;
        }

        const content = normalizeNoteContent(input);
        if (!content.trim()) {
          delete appNotes[normalizedAppKey];
        } else {
          appNotes[normalizedAppKey] = {
            content,
            updatedAt: new Date().toISOString()
          };
        }

        syncNoteDirtyState();
        syncNoteSidebarTrigger();
        syncNoteAppSelect();
        refreshNoteSidebarStatus();
      }

      async function savePreviewState(nextAppNotes) {
        if (!previewStateApiUrl) {
          return false;
        }

        try {
          const response = await fetch(previewStateApiUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              reviews: reviewState,
              appNotes: nextAppNotes || normalizeAppNotesSnapshot(persistedAppNotes)
            })
          });
          if (!response.ok) {
            throw new Error('SAVE_FAILED');
          }
          refreshNoteSidebarStatus();
          return true;
        } catch {
          if (noteSidebarStatus instanceof HTMLElement) {
            noteSidebarStatus.textContent = '저장 실패: 연결 상태를 확인하세요.';
          }
          // Keep UI behavior even when persistence fails.
          return false;
        }
      }

      function schedulePreviewStateSave() {
        if (!previewStateApiUrl) {
          return;
        }

        if (saveStateTimer) {
          window.clearTimeout(saveStateTimer);
        }

        saveStateTimer = window.setTimeout(() => {
          savePreviewState();
        }, 220);
      }

      async function saveAppNotesManually() {
        if (!previewStateApiUrl) {
          if (noteSidebarStatus instanceof HTMLElement) {
            noteSidebarStatus.textContent = '저장 API가 없어 새로고침 시 노트가 유지되지 않습니다.';
          }
          return;
        }

        if (noteSidebarStatus instanceof HTMLElement) {
          noteSidebarStatus.textContent = '저장 중...';
        }

        const snapshot = normalizeAppNotesSnapshot(appNotes);
        const saved = await savePreviewState(snapshot);
        if (!saved) {
          return;
        }

        copyAppNotesMap(persistedAppNotes, snapshot);
        syncNoteDirtyState();
        syncNoteSidebarTrigger();
        syncNoteAppSelect();
        refreshNoteSidebarStatus();
      }

      async function loadPreviewState() {
        if (!previewStateApiUrl || stateLoaded) {
          syncAllCardStateVisuals();
          applySearch();
          syncNoteDirtyState();
          syncNoteSidebarTrigger();
          syncNoteAppSelect();
          selectNoteApp(activeNoteAppKey || defaultNoteAppKey);
          return;
        }

        stateLoaded = true;

        try {
          const response = await fetch(previewStateApiUrl, {
            method: 'GET'
          });

          if (!response.ok) {
            syncAllCardStateVisuals();
            applySearch();
            syncNoteDirtyState();
            syncNoteSidebarTrigger();
            syncNoteAppSelect();
            selectNoteApp(activeNoteAppKey || defaultNoteAppKey);
            return;
          }

          const payload = await response.json();
          const rows = payload && typeof payload === 'object' && payload.reviews && typeof payload.reviews === 'object'
            ? payload.reviews
            : {};
          const notes = payload && typeof payload === 'object' && payload.appNotes && typeof payload.appNotes === 'object'
            ? payload.appNotes
            : {};

          Object.keys(reviewState).forEach((key) => {
            delete reviewState[key];
          });

          Object.entries(rows).forEach(([reviewId, row]) => {
            if (!reviewId || !row || typeof row !== 'object') {
              return;
            }

            const hasExplicitTags = Object.prototype.hasOwnProperty.call(row, 'tags') && Array.isArray(row.tags);
            const tags = normalizeTagList(Array.isArray(row.tags) ? row.tags : []);
            const excluded = Boolean(row.excluded);
            if (!excluded && !hasExplicitTags) {
              return;
            }

            reviewState[reviewId] = {
              tags: hasExplicitTags ? tags : undefined,
              excluded,
              updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString()
            };
          });

          Object.keys(appNotes).forEach((key) => {
            delete appNotes[key];
          });

          Object.entries(notes).forEach(([appKey, row]) => {
            if (!appKey || !row || typeof row !== 'object') {
              return;
            }

            const content = normalizeNoteContent(typeof row.content === 'string' ? row.content : '');
            if (!content.trim()) {
              return;
            }

            appNotes[appKey] = {
              content,
              updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString()
            };
          });
        } catch {
          // Keep UI behavior even when loading persistence fails.
        }

        copyAppNotesMap(persistedAppNotes, appNotes);
        syncNoteDirtyState();
        syncAllCardStateVisuals();
        applySearch();
        syncNoteSidebarTrigger();
        syncNoteAppSelect();
        selectNoteApp(activeNoteAppKey || defaultNoteAppKey);
        refreshNoteSidebarStatus();
      }

      function visibleEvidenceRows() {
        return Array.from(viewBacklog.querySelectorAll('.evidence-row')).filter(
          (row) => !row.classList.contains('hidden-by-search')
        );
      }

      function toggleEvidenceRowById(evidenceId) {
        const evidenceRow = document.getElementById(evidenceId);
        if (!evidenceRow || evidenceRow.classList.contains('hidden-by-search')) {
          return;
        }

        const opened = evidenceRow.classList.toggle('open');
        const button = viewBacklog.querySelector('.evidence-toggle[data-evidence-id=\"' + evidenceId + '\"]');
        if (button instanceof HTMLElement) {
          setEvidenceToggleButtonState(button, opened);
        }
        if (!opened) {
          closeEvidenceDetailRows(evidenceRow);
        }
        syncEvidenceToggleText();
      }

      function setEvidenceToggleButtonState(button, opened) {
        if (!(button instanceof HTMLElement)) {
          return;
        }
        const label = opened ? '근거 숨기기' : '근거 보기';
        button.setAttribute('aria-expanded', opened ? 'true' : 'false');
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
      }

      function setEvidenceDetailButtonState(button, opened) {
        if (!(button instanceof HTMLElement)) {
          return;
        }
        button.setAttribute('aria-expanded', opened ? 'true' : 'false');
        button.textContent = opened ? '접기' : '자세히보기';
      }

      function closeEvidenceDetailRows(scope) {
        if (!(scope instanceof HTMLElement)) {
          return;
        }
        const detailRows = Array.from(scope.querySelectorAll('.evidence-detail.open'));
        detailRows.forEach((detail) => {
          detail.classList.remove('open');
          const detailId = detail.getAttribute('id');
          if (!detailId) {
            return;
          }
          const button = scope.querySelector('.evidence-detail-toggle[data-evidence-detail-id=\"' + detailId + '\"]');
          setEvidenceDetailButtonState(button, false);
        });
      }

      function toggleEvidenceDetailById(detailId) {
        const detail = document.getElementById(detailId);
        if (!(detail instanceof HTMLElement)) {
          return;
        }
        const opened = detail.classList.toggle('open');
        const button = root.querySelector('.evidence-detail-toggle[data-evidence-detail-id=\"' + detailId + '\"]');
        setEvidenceDetailButtonState(button, opened);
      }

      function syncEvidenceToggleText() {
        const rows = visibleEvidenceRows();
        const allOpen = rows.length > 0 && rows.every((row) => row.classList.contains('open'));
        toggleEvidenceAll.textContent = allOpen ? '근거 접기' : '근거 펼치기';
        toggleEvidenceAll.disabled = !viewBacklog.classList.contains('active') || rows.length === 0;
      }

      function applyBacklogSearch(searchQuery) {
        const query = String(searchQuery || '');

        backlogItems.forEach((item) => {
          const rowPriority = (item.getAttribute('data-priority') || '').trim().toLowerCase();
          const hideByPriority = backlogPriorityFilterMode !== 'all' && rowPriority !== backlogPriorityFilterMode;
          const visible = (!query || getSearchableText(item).includes(query)) && !hideByPriority;
          item.classList.toggle('hidden-by-search', !visible);

          const evidenceId = item.getAttribute('data-evidence-id');
          if (!evidenceId) {
            return;
          }
          const evidenceRow = document.getElementById(evidenceId);
          if (!evidenceRow) {
            return;
          }

          evidenceRow.classList.toggle('hidden-by-search', !visible);

          if (!visible) {
            evidenceRow.classList.remove('open');
            closeEvidenceDetailRows(evidenceRow);
            const evidenceToggle = item.querySelector('.evidence-toggle');
            setEvidenceToggleButtonState(evidenceToggle, false);
          }
        });
      }

      function applySearch(options) {
        const q = getSearchQuery();

        if (viewRaw.classList.contains('active')) {
          applyRawStateFilters(q);
          applyRawPagination();
        } else {
          applyBacklogSearch(q);
          syncEvidenceToggleText();
        }

        syncFilterSummary();
        const shouldSyncQuery = !options || options.syncQuery !== false;
        if (shouldSyncQuery) {
          syncUiQuery();
        }
      }

      function scheduleApplySearch() {
        if (searchApplyRaf) {
          window.cancelAnimationFrame(searchApplyRaf);
        }
        searchApplyRaf = window.requestAnimationFrame(() => {
          searchApplyRaf = 0;
          applySearch();
        });
      }

      function setTab(raw, options) {
        const shouldSyncQuery = !options || options.syncQuery !== false;
        if (raw) {
          tabRaw.classList.add('active');
          tabBacklog.classList.remove('active');
          viewRaw.classList.add('active');
          viewBacklog.classList.remove('active');
          contextRaw.classList.add('active');
          contextBacklog.classList.remove('active');
        } else {
          tabRaw.classList.remove('active');
          tabBacklog.classList.add('active');
          viewRaw.classList.remove('active');
          viewBacklog.classList.add('active');
          contextRaw.classList.remove('active');
          contextBacklog.classList.add('active');
        }

        if (activeFilterChips instanceof HTMLElement) {
          activeFilterChips.classList.toggle('hidden-control', !raw);
        }
        if (openFilterPanelButton instanceof HTMLElement) {
          openFilterPanelButton.classList.toggle('hidden-control', !raw);
        }
        if (topStatusRow instanceof HTMLElement) {
          topStatusRow.classList.toggle('hidden-control', !raw);
        }
        if (priorityFilter instanceof HTMLElement) {
          priorityFilter.classList.toggle('hidden-control', raw);
        }
        if (!raw) {
          closeFilterPanel();
        }
        toggleEvidenceAll.classList.toggle('hidden-control', raw);
        syncEvidenceToggleText();
        syncFilterPanelTrigger();
        applySearch({ syncQuery: shouldSyncQuery });
      }

      function applyInitialQueryState() {
        const queryState = resolveUiStateFromQuery();

        if (searchInput instanceof HTMLInputElement) {
          searchInput.value = queryState.search;
        }
        if (toggleAll instanceof HTMLInputElement) {
          toggleAll.checked = queryState.showOriginal;
          document.body.classList.toggle('show-all-original', queryState.showOriginal);
        }
        if (minLength100 instanceof HTMLInputElement) {
          minLength100.checked = queryState.minLength100;
        }

        selectedTagFilters.clear();
        queryState.tags.forEach((tag) => {
          selectedTagFilters.add(tag);
        });

        rawCurrentPage = queryState.rawPage;
        setExcludeFilterMode(queryState.excludeMode);
        setBacklogPriorityFilterMode(queryState.backlogPriorityMode);
        syncTagFilterButtons();
        syncActiveFilterChips();
        setSearchExpanded(queryState.search.length > 0);
        syncAllCardStateVisuals();
        setTab(queryState.rawTab, { syncQuery: true });
      }

      tabRaw.addEventListener('click', () => setTab(true, { syncQuery: true }));
      tabBacklog.addEventListener('click', () => setTab(false, { syncQuery: true }));
      toggleEvidenceAll.addEventListener('click', () => {
        const rows = visibleEvidenceRows();
        if (!rows.length) return;

        const openAll = !rows.every((row) => row.classList.contains('open'));
        rows.forEach((row) => {
          row.classList.toggle('open', openAll);
          if (!openAll) {
            closeEvidenceDetailRows(row);
          }
          const evidenceId = row.getAttribute('id');
          if (!evidenceId) return;
          const button = viewBacklog.querySelector('.evidence-toggle[data-evidence-id=\"' + evidenceId + '\"]');
          setEvidenceToggleButtonState(button, openAll);
        });

        syncEvidenceToggleText();
      });
      root.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const evidenceToggle = target.closest('.evidence-toggle');
        if (evidenceToggle instanceof HTMLElement) {
          event.preventDefault();
          const evidenceId = evidenceToggle.getAttribute('data-evidence-id');
          if (!evidenceId) {
            return;
          }
          toggleEvidenceRowById(evidenceId);
          return;
        }

        const evidenceDetailToggle = target.closest('.evidence-detail-toggle');
        if (evidenceDetailToggle instanceof HTMLElement) {
          event.preventDefault();
          const detailId = evidenceDetailToggle.getAttribute('data-evidence-detail-id');
          if (!detailId) {
            return;
          }
          toggleEvidenceDetailById(detailId);
          return;
        }

        const toggleOne = target.closest('.toggle-one');
        if (toggleOne instanceof HTMLElement) {
          const card = toggleOne.closest('.quote-card');
          if (!card) return;

          card.classList.toggle('show-one-original');
          syncOriginalToggleButton(card);
          return;
        }

        const tagToggle = target.closest('.tag-toggle');
        if (tagToggle instanceof HTMLElement) {
          const card = tagToggle.closest('.quote-card');
          const reviewId = getCardReviewId(card);
          const tag = normalizeTag(tagToggle.getAttribute('data-tag'));
          if (!card || !reviewId || !tag) return;

          const state = readCardState(reviewId, card);
          if (state.excluded) {
            return;
          }

          const tags = state.tags.includes(tag)
            ? state.tags.filter((item) => item !== tag)
            : state.tags.concat([tag]);
          state.tags = normalizeTagList(tags);
          writeCardState(reviewId, state, card);
          syncCardStateVisual(card);
          applySearch();
          schedulePreviewStateSave();
          return;
        }

        const excludeToggle = target.closest('.exclude-toggle');
        if (excludeToggle instanceof HTMLElement) {
          const card = excludeToggle.closest('.quote-card');
          const reviewId = getCardReviewId(card);
          if (!card || !reviewId) return;
          const state = readCardState(reviewId, card);
          state.excluded = !state.excluded;
          writeCardState(reviewId, state, card);
          syncCardStateVisual(card);
          applySearch();
          schedulePreviewStateSave();
        }
      });

      if (noteSidebarBackdrop instanceof HTMLElement) {
        noteSidebarBackdrop.addEventListener('click', closeAppNoteSidebar);
      }
      if (noteSidebarClose instanceof HTMLElement) {
        noteSidebarClose.addEventListener('click', closeAppNoteSidebar);
      }
      if (noteSidebarSave instanceof HTMLElement) {
        noteSidebarSave.addEventListener('click', saveAppNotesManually);
      }
      if (openSearchInputButton instanceof HTMLElement) {
        openSearchInputButton.addEventListener('click', () => {
          const isOpen = topBar instanceof HTMLElement && topBar.classList.contains('is-search-open');
          if (isOpen && getSearchQuery().length === 0) {
            setSearchExpanded(false);
            return;
          }
          setSearchExpanded(true);
          if (searchInput instanceof HTMLInputElement) {
            window.setTimeout(() => searchInput.focus(), 0);
          }
        });
      }
      if (openNoteSidebarButton instanceof HTMLElement) {
        openNoteSidebarButton.addEventListener('click', openAppNoteSidebar);
      }
      if (noteAppSelect instanceof HTMLSelectElement) {
        noteAppSelect.addEventListener('change', () => {
          selectNoteApp(noteAppSelect.value);
        });
      }
      if (openFilterPanelButton instanceof HTMLElement) {
        openFilterPanelButton.addEventListener('click', openFilterPanel);
      }
      if (filterPanelBackdrop instanceof HTMLElement) {
        filterPanelBackdrop.addEventListener('click', closeFilterPanel);
      }
      if (filterPanelClose instanceof HTMLElement) {
        filterPanelClose.addEventListener('click', closeFilterPanel);
      }
      if (noteSidebarText instanceof HTMLTextAreaElement) {
        noteSidebarText.addEventListener('input', () => {
          if (!activeNoteAppKey) {
            return;
          }
          writeAppNote(activeNoteAppKey, noteSidebarText.value);
        });
      }
      if (searchInput instanceof HTMLInputElement) {
        searchInput.addEventListener('focus', () => {
          setSearchExpanded(true);
        });
      }
      document.addEventListener('keydown', (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          if (noteSidebarRoot instanceof HTMLElement && !noteSidebarRoot.hidden) {
            event.preventDefault();
            saveAppNotesManually();
            return;
          }
        }
        if (event.key === 'Escape') {
          if (getSearchQuery().length === 0) {
            setSearchExpanded(false);
          }
        }
        if (event.key === 'Escape') {
          closeAppNoteSidebar();
          closeFilterPanel();
        }
      });

      toggleAll.addEventListener('change', () => {
        if (toggleAll.checked) {
          document.body.classList.add('show-all-original');
        } else {
          document.body.classList.remove('show-all-original');
        }
        syncUiQuery();
      });

      minLength100.addEventListener('change', () => {
        rawCurrentPage = 1;
        applySearch();
      });
      tagFilterButtons.forEach((button) => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        button.addEventListener('click', () => {
          const mode = (button.getAttribute('data-tag-filter') || '').trim();
          setTagFilterMode(mode);
          rawCurrentPage = 1;
          applySearch();
        });
      });
      if (clearFiltersButton instanceof HTMLElement) {
        clearFiltersButton.addEventListener('click', resetRawFilters);
      }
      if (resetAllExcludedButton instanceof HTMLElement) {
        resetAllExcludedButton.addEventListener('click', resetAllReviewsToExcluded);
      }
      excludeFilterButtons.forEach((button) => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        button.addEventListener('click', () => {
          const mode = (button.getAttribute('data-exclude-filter') || '').trim();
          setExcludeFilterMode(mode);
          rawCurrentPage = 1;
          applySearch();
        });
      });
      priorityFilterButtons.forEach((button) => {
        if (!(button instanceof HTMLElement)) {
          return;
        }

        button.addEventListener('click', () => {
          const mode = (button.getAttribute('data-priority-filter') || '').trim();
          setBacklogPriorityFilterMode(mode);
          applySearch();
        });
      });
      searchInput.addEventListener('input', () => {
        rawCurrentPage = 1;
        setSearchExpanded(true);
        scheduleApplySearch();
      });
      document.addEventListener('click', (event) => {
        if (getSearchQuery().length > 0) {
          return;
        }
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }

        const inSearch = searchFixed instanceof HTMLElement && searchFixed.contains(target);
        if (inSearch) {
          return;
        }
        setSearchExpanded(false);
      });
      if (rawPagePrev instanceof HTMLButtonElement) {
        rawPagePrev.addEventListener('click', () => {
          if (rawCurrentPage <= 1) {
            return;
          }
          rawCurrentPage -= 1;
          applyRawPagination();
          syncFilterSummary();
          syncUiQuery();
        });
      }
      if (rawPageNext instanceof HTMLButtonElement) {
        rawPageNext.addEventListener('click', () => {
          if (rawCurrentPage >= rawTotalPages) {
            return;
          }
          rawCurrentPage += 1;
          applyRawPagination();
          syncFilterSummary();
          syncUiQuery();
        });
      }
      applyInitialQueryState();
      loadPreviewState();
    </script>
  </body>
</html>`;
}

async function main(): Promise<void> {
  const argv = await parseArgs();
  if (argv.all) {
    if (normalizeText(argv.myApp)) {
      throw new Error("`--all` cannot be used with `--my-app`.");
    }
    if (normalizeText(argv.input) || normalizeText(argv.output)) {
      throw new Error("`--all` cannot be used with `--input` or `--output`.");
    }

    const ownerAppIds = await findOwnerAppIdsForBatchRender();
    if (ownerAppIds.length === 0) {
      throw new Error(
        `No render targets found. Expected files: data/{appId}/${REPORTS_DIR_NAME}/${DEFAULT_REPORT_MARKDOWN_FILE}`
      );
    }

    for (const ownerAppId of ownerAppIds) {
      const inputPath = resolveDefaultInput(ownerAppId);
      const outputPath = resolveDefaultOutput(ownerAppId);
      const raw = await fs.readFile(inputPath, "utf8");
      const parsed = parseMarkdown(raw);
      const reviewPools = await loadReviewPools(ownerAppId);
      const backlog = buildBacklog(parsed.apps, reviewPools);
      const ownerAppIconMetaHref = await resolveOwnerAppIconMetaHref(ownerAppId);
      const html = renderHtml(
        parsed.title,
        parsed.apps,
        backlog,
        ownerAppId,
        reviewPools,
        ownerAppIconMetaHref
      );

      await fs.mkdir(path.dirname(outputPath), { recursive: true });
      await fs.writeFile(outputPath, html, "utf8");
      console.log(`[${ownerAppId}] Rendered HTML report: ${outputPath}`);
    }

    console.log(`Rendered HTML reports for ${ownerAppIds.length} app(s).`);
    return;
  }

  if (!normalizeText(argv.myApp)) {
    throw new Error("`--my-app` is required unless `--all` is set.");
  }

  const owner = await resolveOwnerApp(String(argv.myApp), argv.registeredAppsPath);
  const ownerAppId = owner.ownerAppId;
  const inputPath = normalizeText(argv.input) ? path.resolve(process.cwd(), String(argv.input)) : resolveDefaultInput(ownerAppId);
  const outputPath = normalizeText(argv.output)
    ? path.resolve(process.cwd(), String(argv.output))
    : resolveDefaultOutput(ownerAppId);
  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = parseMarkdown(raw);
  const reviewPools = await loadReviewPools(ownerAppId);
  const backlog = buildBacklog(parsed.apps, reviewPools);
  const ownerAppIconMetaHref = await resolveOwnerAppIconMetaHref(ownerAppId);
  const html = renderHtml(
    parsed.title,
    parsed.apps,
    backlog,
    ownerAppId,
    reviewPools,
    ownerAppIconMetaHref
  );

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, "utf8");

  console.log(`Rendered HTML report: ${outputPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
