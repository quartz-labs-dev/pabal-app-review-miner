#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { resolveOwnerApp } from "./registeredApps";
import { normalizeText } from "./utils";

interface CliArgs {
  myApp?: string;
  registeredAppsPath?: string;
  input?: string;
  output?: string;
}

type CategoryKey = "satisfaction" | "dissatisfaction" | "requests";
type Priority = "must" | "should" | "could";
type Impact = "high" | "medium" | "low";
type Effort = "high" | "medium" | "low";

interface QuoteItem {
  meta: string;
  kr: string;
  org: string;
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
  examples: QuoteItem[];
}

interface AppBacklog {
  appTitle: string;
  reviewCount: string;
  items: BacklogItem[];
}

const THEMES: ThemeDefinition[] = [
  {
    id: "reliability_performance",
    title: "Core Flow Reliability (Loading/Crash/Sync)",
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
    action: "Prioritize stability fixes in core journeys such as login, playback, alerts, and map entry."
  },
  {
    id: "multi_location_planning",
    title: "Multi-Location and Trip Planning Support",
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
    action: "Let users save remote locations beyond current GPS location for comparison and trip planning."
  },
  {
    id: "alert_relevance",
    title: "Alert Relevance Improvements (Daylight/Cloud/Local Filters)",
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
    action: "Reduce alert noise by applying local sunrise/sunset, cloud cover, and user-defined thresholds."
  },
  {
    id: "advanced_alert_logic",
    title: "Advanced Alert Rules (Multi-Condition Triggers)",
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
    action: "Support advanced triggers based on combined conditions (for example Bz + solar wind speed)."
  },
  {
    id: "forecast_transparency",
    title: "Forecast Reliability and Source Transparency",
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
    action: "Disclose forecast models/sources and provide multi-model comparison or calibration guidance."
  },
  {
    id: "notification_controls",
    title: "Notification Control Granularity",
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
    action: "Provide personalized control across notification frequency, time window, trigger, and channel."
  },
  {
    id: "widget_watch_screen",
    title: "Widget/Watch/Large-Screen Optimization",
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
    action: "Optimize usage context per device, including widgets, Apple Watch, tablets, and landscape mode."
  },
  {
    id: "pricing_paywall",
    title: "Pricing and Paywall Clarity",
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
    action: "Clearly communicate paid features, pricing, refund policy, and trial conditions up front."
  },
  {
    id: "offline_playback",
    title: "Offline Download and Playback Quality",
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
    action: "Improve media reliability around download queue/resume, chapter navigation, casting, and fullscreen."
  },
  {
    id: "timezone_localization",
    title: "Timezone and Localization Accuracy",
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
    action: "Clarify timezone display/calculation logic and offer user-selectable timezone options."
  }
];

const PRIORITY_BOOST_THEME_IDS = new Set([
  "reliability_performance",
  "offline_playback",
  "alert_relevance",
  "multi_location_planning"
]);

const REVIEW_COUNT_PREFIXES = ["- 전체 리뷰 수:", "- Total review count:"];

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

function resolveDefaultInput(ownerAppId: string): string {
  return path.resolve(process.cwd(), "data", ownerAppId, "reports", "competitor-raw-actionable.ko.md");
}

function resolveDefaultOutput(ownerAppId: string): string {
  return path.resolve(process.cwd(), "data", ownerAppId, "reports", "competitor-raw-actionable.ko.html");
}

async function parseArgs(): Promise<CliArgs> {
  const parsed = await yargs(hideBin(process.argv))
    .scriptName("report:render-html")
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

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function mapCategory(heading: string): CategoryKey | undefined {
  const normalized = heading.toLowerCase();
  if (includesAny(heading, ["만족"]) || includesAny(normalized, ["satisfaction"])) {
    return "satisfaction";
  }
  if (includesAny(heading, ["불만"]) || includesAny(normalized, ["dissatisfaction"])) {
    return "dissatisfaction";
  }
  if (includesAny(heading, ["요청", "개선"]) || includesAny(normalized, ["request", "improvement"])) {
    return "requests";
  }
  return undefined;
}

function parseMarkdown(input: string): { title: string; metadata: string[]; apps: AppSection[] } {
  const lines = input.split(/\r?\n/);
  let title = "Raw Review Report";
  const metadata: string[] = [];
  const apps: AppSection[] = [];

  let currentApp: AppSection | undefined;
  let currentCategory: CategoryKey | undefined;
  let currentQuote: QuoteItem | undefined;

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
      meta: normalizeText(currentQuote.meta),
      kr,
      org
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
    return "Satisfaction (Concrete Examples)";
  }
  if (key === "dissatisfaction") {
    return "Dissatisfaction (Concrete Problems)";
  }
  return "Requested Features / Improvement Suggestions";
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

function buildBacklog(apps: AppSection[]): AppBacklog[] {
  return apps.map((app) => {
    const buckets = new Map<
      string,
      {
        theme: ThemeDefinition;
        reqCount: number;
        negCount: number;
        posCount: number;
        examples: QuoteItem[];
      }
    >();

    for (const categoryKey of Object.keys(app.categories) as CategoryKey[]) {
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
              examples: []
            };

          if (categoryKey === "requests") {
            bucket.reqCount += 1;
          } else if (categoryKey === "dissatisfaction") {
            bucket.negCount += 1;
          } else {
            bucket.posCount += 1;
          }

          if (bucket.examples.length < 4) {
            bucket.examples.push(quote);
          }

          buckets.set(theme.id, bucket);
        }
      }
    }

    const items: BacklogItem[] = [...buckets.values()]
      .map((bucket) => {
        const evidenceCount = bucket.reqCount + bucket.negCount + bucket.posCount;
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
          examples: bucket.examples.slice(0, 2)
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

function renderHtml(title: string, metadata: string[], apps: AppSection[], backlogs: AppBacklog[]): string {
  const rawAppSections = apps
    .map((app) => {
      const categoryBlocks = (Object.keys(app.categories) as CategoryKey[])
        .map((categoryKey) => {
          const items = app.categories[categoryKey];
          const cards =
            items.length === 0
              ? `<p class=\"empty\">No items in this section.</p>`
              : items
                  .map((item) => {
                    const kr = escapeHtml(item.kr || "(No Korean translation)");
                    const org = escapeHtml(item.org || "(No original text)");

                    return `
                      <article class=\"quote-card searchable\" data-search=\"${escapeHtml(
                        `${app.title} ${renderCategoryTitle(categoryKey)} ${item.meta} ${item.kr} ${item.org}`
                      ).toLowerCase()}\">
                        <div class=\"quote-meta\">${escapeHtml(item.meta)}</div>
                        <div class=\"quote-kr\">${kr}</div>
                        <div class=\"quote-org org-text\">${org}</div>
                        <button class=\"toggle-one\" type=\"button\">Show Original</button>
                      </article>
                    `;
                  })
                  .join("\n");

          return `
            <section class=\"category\">
              <h3>${escapeHtml(renderCategoryTitle(categoryKey))}</h3>
              <div class=\"cards\">
                ${cards}
              </div>
            </section>
          `;
        })
        .join("\n");

      return `
        <details class=\"app\" open>
          <summary>
            <span class=\"app-title\">${escapeHtml(app.title)}</span>
            <span class=\"app-count\">Reviews ${escapeHtml(app.reviewCount ?? "-")}</span>
          </summary>
          <div class=\"app-body\">
            ${categoryBlocks}
          </div>
        </details>
      `;
    })
    .join("\n");

  const backlogSections = backlogs
    .map((appBacklog) => {
      const counts = {
        must: appBacklog.items.filter((item) => item.priority === "must").length,
        should: appBacklog.items.filter((item) => item.priority === "should").length,
        could: appBacklog.items.filter((item) => item.priority === "could").length
      };

      const rows =
        appBacklog.items.length === 0
          ? `<tr><td colspan=\"6\" class=\"empty\">No actionable backlog items extracted.</td></tr>`
          : appBacklog.items
              .map((item) => {
                const examples = item.examples
                  .map(
                    (q) => `
                    <li>
                      <div class=\"example-kr\">KR: ${escapeHtml(q.kr || q.org)}</div>
                      <div class=\"example-org org-text\">ORG: ${escapeHtml(q.org || "")}</div>
                    </li>
                  `
                  )
                  .join("\n");

                return `
                  <tr class=\"backlog-item searchable\" data-search=\"${escapeHtml(
                    `${appBacklog.appTitle} ${item.priority} ${item.title} ${item.action} ${item.examples
                      .map((q) => `${q.kr} ${q.org}`)
                      .join(" ")}`
                  ).toLowerCase()}\">
                    <td>${renderPriorityBadge(item.priority)}</td>
                    <td>
                      <div class=\"item-title\">${escapeHtml(item.title)}</div>
                      <div class=\"item-action\">${escapeHtml(item.action)}</div>
                    </td>
                    <td>${renderLevel(item.impact)}</td>
                    <td>${renderLevel(item.effort)}</td>
                    <td>${item.evidenceCount}</td>
                    <td>
                      <details>
                        <summary>View Evidence</summary>
                        <ul class=\"evidence-list\">${examples}</ul>
                      </details>
                    </td>
                  </tr>
                `;
              })
              .join("\n");

      return `
        <details class=\"app\" open>
          <summary>
            <span class=\"app-title\">${escapeHtml(appBacklog.appTitle)}</span>
            <span class=\"app-count\">Reviews ${escapeHtml(appBacklog.reviewCount)} / MUST ${counts.must} · SHOULD ${counts.should} · COULD ${counts.could}</span>
          </summary>
          <div class=\"app-body\">
            <div class=\"table-wrap\">
              <table>
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Backlog Item</th>
                    <th>Impact</th>
                    <th>Effort</th>
                    <th>Evidence Count</th>
                    <th>Evidence</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    })
    .join("\n");

  const metadataHtml = metadata.map((line) => `<li>${escapeHtml(line)}</li>`).join("\n");

  return `<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #f3f6fb;
        --panel: #ffffff;
        --ink: #0f172a;
        --sub: #475569;
        --line: #dbe2ea;
        --accent: #0ea5e9;
        --must: #dc2626;
        --should: #ea580c;
        --could: #15803d;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        color: var(--ink);
        background: radial-gradient(circle at top right, #e0f2fe 0%, var(--bg) 45%);
      }
      .wrap {
        max-width: 1240px;
        margin: 0 auto;
        padding: 20px 14px 40px;
      }
      .top {
        position: sticky;
        top: 0;
        z-index: 20;
        backdrop-filter: blur(8px);
        background: rgba(243, 246, 251, 0.86);
        border-bottom: 1px solid var(--line);
      }
      .top-inner {
        max-width: 1240px;
        margin: 0 auto;
        padding: 10px 14px;
        display: grid;
        grid-template-columns: 1fr auto auto auto;
        gap: 10px;
        align-items: center;
      }
      .tabs { display: flex; gap: 6px; }
      .tab-btn {
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--ink);
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 13px;
        cursor: pointer;
      }
      .tab-btn.active {
        border-color: var(--accent);
        color: #0369a1;
        background: #e0f2fe;
      }
      h1 {
        margin: 8px 0 10px;
        font-size: 1.45rem;
      }
      .meta {
        margin: 0 0 18px;
        padding: 12px 16px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel);
      }
      .meta ul { margin: 0; padding-left: 18px; }
      input[type=\"search\"] {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        font-size: 14px;
      }
      button, .toggle-all-label {
        border: 1px solid var(--line);
        background: var(--panel);
        color: var(--ink);
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 13px;
      }
      .toggle-all-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .app {
        border: 1px solid var(--line);
        border-radius: 14px;
        margin-bottom: 14px;
        background: var(--panel);
        overflow: hidden;
      }
      .app > summary {
        cursor: pointer;
        list-style: none;
        padding: 13px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: linear-gradient(180deg, #ffffff, #f8fbff);
      }
      .app > summary::-webkit-details-marker { display: none; }
      .app-title { font-weight: 700; }
      .app-count { color: var(--sub); font-size: 12px; }
      .app-body { padding: 4px 12px 12px; }
      .category h3 { margin: 12px 2px 8px; font-size: 1rem; }
      .cards {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
      }
      .quote-card {
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 10px 12px;
        background: #fff;
      }
      .quote-meta { color: var(--sub); font-size: 12px; margin-bottom: 8px; }
      .quote-kr { font-size: 14px; line-height: 1.45; }
      .org-text {
        display: none;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px dashed var(--line);
        color: #334155;
        font-size: 13px;
        line-height: 1.4;
      }
      .show-all-original .org-text,
      .quote-card.show-one-original .org-text {
        display: block;
      }
      .toggle-one {
        margin-top: 8px;
        font-size: 12px;
        padding: 6px 8px;
        cursor: pointer;
      }
      .empty { margin: 0; color: var(--sub); font-size: 13px; }
      .hidden-by-search { display: none !important; }
      .view { display: none; }
      .view.active { display: block; }
      .table-wrap { overflow-x: auto; }
      table {
        width: 100%;
        border-collapse: collapse;
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
      }
      th, td {
        padding: 9px 10px;
        border-bottom: 1px solid var(--line);
        text-align: left;
        vertical-align: top;
        font-size: 13px;
      }
      th { background: #f8fbff; color: #0f172a; }
      .item-title { font-weight: 700; margin-bottom: 4px; }
      .item-action { color: #334155; }
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
      .evidence-list { margin: 8px 0 0; padding-left: 16px; }
      .evidence-list li { margin-bottom: 8px; }
      .example-kr { line-height: 1.35; }
      .example-org { margin-top: 6px; }
      @media (min-width: 900px) {
        .cards { grid-template-columns: 1fr 1fr; }
      }
    </style>
  </head>
  <body>
    <div class=\"top\">
      <div class=\"top-inner\">
        <input id=\"search\" type=\"search\" placeholder=\"Search (app name, request, keyword, original text)\" />
        <div class=\"tabs\">
          <button id=\"tabRaw\" class=\"tab-btn active\" type=\"button\">Raw Reviews</button>
          <button id=\"tabBacklog\" class=\"tab-btn\" type=\"button\">Actionable Backlog</button>
        </div>
        <label class=\"toggle-all-label\"><input id=\"toggleAll\" type=\"checkbox\" /> Show all original text</label>
        <button id=\"expandAll\" type=\"button\">Expand all</button>
      </div>
    </div>

    <main class=\"wrap\" id=\"root\">
      <h1>${escapeHtml(title)}</h1>
      <section class=\"meta\">
        <ul>
          ${metadataHtml}
        </ul>
      </section>

      <section id=\"viewRaw\" class=\"view active\">
        ${rawAppSections}
      </section>

      <section id=\"viewBacklog\" class=\"view\">
        ${backlogSections}
      </section>
    </main>

    <script>
      const root = document.getElementById('root');
      const searchInput = document.getElementById('search');
      const toggleAll = document.getElementById('toggleAll');
      const expandAll = document.getElementById('expandAll');
      const tabRaw = document.getElementById('tabRaw');
      const tabBacklog = document.getElementById('tabBacklog');
      const viewRaw = document.getElementById('viewRaw');
      const viewBacklog = document.getElementById('viewBacklog');

      function currentViewElement() {
        return viewRaw.classList.contains('active') ? viewRaw : viewBacklog;
      }

      function currentDetails() {
        return Array.from(currentViewElement().querySelectorAll('details.app'));
      }

      function applySearch() {
        const q = searchInput.value.trim().toLowerCase();
        const searchables = Array.from(currentViewElement().querySelectorAll('.searchable'));

        searchables.forEach((el) => {
          const hay = (el.getAttribute('data-search') || '').toLowerCase();
          const visible = !q || hay.includes(q);
          el.classList.toggle('hidden-by-search', !visible);
        });
      }

      function setTab(raw) {
        if (raw) {
          tabRaw.classList.add('active');
          tabBacklog.classList.remove('active');
          viewRaw.classList.add('active');
          viewBacklog.classList.remove('active');
        } else {
          tabRaw.classList.remove('active');
          tabBacklog.classList.add('active');
          viewRaw.classList.remove('active');
          viewBacklog.classList.add('active');
        }

        applySearch();
      }

      tabRaw.addEventListener('click', () => setTab(true));
      tabBacklog.addEventListener('click', () => setTab(false));

      root.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.classList.contains('toggle-one')) return;

        const card = target.closest('.quote-card');
        if (!card) return;

        card.classList.toggle('show-one-original');
        target.textContent = card.classList.contains('show-one-original') ? 'Hide Original' : 'Show Original';
      });

      toggleAll.addEventListener('change', () => {
        if (toggleAll.checked) {
          document.body.classList.add('show-all-original');
        } else {
          document.body.classList.remove('show-all-original');
        }
      });

      expandAll.addEventListener('click', () => {
        const details = currentDetails();
        const allOpen = details.every((app) => app.open);
        details.forEach((app) => {
          app.open = !allOpen;
        });
        expandAll.textContent = allOpen ? 'Expand all' : 'Collapse all';
      });

      searchInput.addEventListener('input', applySearch);
    </script>
  </body>
</html>`;
}

async function main(): Promise<void> {
  const argv = await parseArgs();
  const owner = await resolveOwnerApp(String(argv.myApp), argv.registeredAppsPath);
  const ownerAppId = owner.ownerAppId;

  const inputPath = normalizeText(argv.input) ? path.resolve(process.cwd(), String(argv.input)) : resolveDefaultInput(ownerAppId);
  const outputPath = normalizeText(argv.output)
    ? path.resolve(process.cwd(), String(argv.output))
    : resolveDefaultOutput(ownerAppId);

  const raw = await fs.readFile(inputPath, "utf8");
  const parsed = parseMarkdown(raw);
  const backlog = buildBacklog(parsed.apps);
  const html = renderHtml(parsed.title, parsed.metadata, parsed.apps, backlog);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html, "utf8");

  console.log(`Rendered HTML report: ${outputPath}`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
