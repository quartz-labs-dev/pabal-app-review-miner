import { promises as fs } from "node:fs";
import path from "node:path";
import { IncomingMessage, ServerResponse } from "node:http";
import { normalizeText } from "../utils";
import { readRequestBody, sendJson, sendMethodNotAllowed, sendNotFound } from "./httpUtils";
import { ApiRouteContext } from "./types";

export const BACKLOG_FILE_NAME = "backlog.ko.json";
export const BACKLOG_API_PREFIX = "/api/backlog/";

const BACKLOG_MAX_BODY_BYTES = 10_000_000;
const BACKLOG_MAX_ITEMS = 2_000;
const BACKLOG_MAX_EVIDENCE_IDS = 200;

type BacklogPriority = "must" | "should" | "could";
type BacklogLevel = "high" | "medium" | "low";
type BacklogStatus = "not_started" | "in_progress" | "done";

interface BacklogApiItem {
  id: string;
  priority: BacklogPriority;
  status: BacklogStatus;
  title: string;
  effort: BacklogLevel;
  action: string;
  evidenceReviewIds: string[];
  appNames: string[];
}

interface BacklogApiState {
  version: 2;
  ownerAppId: string;
  updatedAt: string;
  items: BacklogApiItem[];
}

interface LegacyBacklogDataItem {
  priority: BacklogPriority;
  title: string;
  effort: BacklogLevel;
  action: string;
  evidenceCount: number;
  evidenceReviewIds: string[];
}

interface LegacyBacklogDataApp {
  appTitle: string;
  reviewCount: string;
  items: LegacyBacklogDataItem[];
}

interface LegacyBacklogDataFile {
  version: 1;
  ownerAppId: string;
  generatedAt: string;
  appBacklogs: LegacyBacklogDataApp[];
}

interface BacklogDataFile {
  version: 2;
  ownerAppId: string;
  updatedAt: string;
  items: BacklogApiItem[];
}

function isSafeAppId(appId: string): boolean {
  return /^[a-z0-9._-]+$/i.test(appId);
}

function normalizeBacklogPriority(value: unknown): BacklogPriority {
  const normalized = normalizeText(String(value ?? "")).toLowerCase();
  if (normalized === "must" || normalized === "should" || normalized === "could") {
    return normalized;
  }
  return "should";
}

function normalizeBacklogLevel(value: unknown): BacklogLevel {
  const normalized = normalizeText(String(value ?? "")).toLowerCase();
  if (normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function normalizeBacklogStatus(value: unknown): BacklogStatus {
  const normalized = normalizeText(String(value ?? "")).toLowerCase();
  if (normalized === "not_started" || normalized === "in_progress" || normalized === "done") {
    return normalized;
  }
  return "not_started";
}

function normalizeBacklogEvidenceId(value: unknown): string {
  const normalized = normalizeText(String(value ?? ""));
  if (!normalized) {
    return "";
  }
  if (normalized.length > 500) {
    return normalized.slice(0, 500);
  }
  return normalized;
}

function normalizeBacklogScopeToken(value: unknown): string {
  const normalized = normalizeText(String(value ?? "")).toLowerCase();
  if (!normalized) {
    return "";
  }
  return normalized.replace(/\s+/g, "-").replace(/[^a-z0-9._-]+/g, "");
}

function sanitizeBacklogText(value: unknown): string {
  return normalizeText(String(value ?? ""));
}

function sanitizeBacklogAction(value: unknown): string {
  let text = normalizeText(String(value ?? ""));
  text = text
    .replace(/\(\s*(?:근거\s*)?리뷰\s*\d+\s*건\s*\)/gi, "")
    .replace(/\(\s*evidence\s*\d+\s*reviews?\s*\)/gi, "")
    .replace(/(?:근거\s*)?리뷰\s*\d+\s*건/gi, "")
    .replace(/evidence\s*\d+\s*reviews?/gi, "");
  return normalizeText(text.replace(/\s{2,}/g, " "));
}

function backlogSimilarityText(value: unknown): string {
  return normalizeText(String(value ?? ""))
    .toLowerCase()
    .replace(/\(\s*(?:근거\s*)?리뷰\s*\d+\s*건\s*\)/gi, "")
    .replace(/\(\s*evidence\s*\d+\s*reviews?\s*\)/gi, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createBacklogSimilarityKey(title: unknown, action: unknown): string {
  return `${backlogSimilarityText(title)}||${backlogSimilarityText(action)}`;
}

function backlogLevelRank(level: BacklogLevel): number {
  if (level === "high") {
    return 3;
  }
  if (level === "medium") {
    return 2;
  }
  return 1;
}

function toScopedEvidenceId(value: unknown, fallbackScope = "global"): string {
  const normalized = normalizeBacklogEvidenceId(value);
  if (!normalized) {
    return "";
  }

  const delimiter = normalized.indexOf("::");
  if (delimiter >= 0) {
    const scope = normalizeBacklogScopeToken(normalized.slice(0, delimiter)) || "global";
    const reviewId = normalizeBacklogEvidenceId(normalized.slice(delimiter + 2));
    if (!reviewId) {
      return "";
    }
    return `${scope}::${reviewId}`;
  }

  const scope = normalizeBacklogScopeToken(fallbackScope) || "global";
  return `${scope}::${normalized}`;
}

function extractBaseReviewId(value: unknown): string {
  const normalized = normalizeBacklogEvidenceId(value);
  if (!normalized) {
    return "";
  }
  const parts = normalized.split("::");
  return normalizeBacklogEvidenceId(parts[parts.length - 1] ?? normalized);
}

function parseBacklogAppTitle(rawTitle: string): { displayName: string; sourceToken?: string } {
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

function resolveLegacyScopeToken(rawTitle: string): string {
  const parsed = parseBacklogAppTitle(rawTitle);
  return (
    normalizeBacklogScopeToken(parsed.sourceToken) ||
    normalizeBacklogScopeToken(parsed.displayName) ||
    "global"
  );
}

function backlogPath(dataRoot: string, ownerAppId: string): string {
  return path.resolve(dataRoot, ownerAppId, "reports", BACKLOG_FILE_NAME);
}

function backlogPriorityRank(priority: BacklogPriority): number {
  if (priority === "must") {
    return 0;
  }
  if (priority === "should") {
    return 1;
  }
  return 2;
}

function normalizeBacklogApiItem(value: unknown, fallbackId: string): BacklogApiItem | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const row = value as Record<string, unknown>;
  const title = sanitizeBacklogText(row.title);
  const action = sanitizeBacklogAction(row.action);
  if (!title || !action) {
    return undefined;
  }

  const evidenceRaw = Array.isArray(row.evidenceReviewIds) ? (row.evidenceReviewIds as unknown[]) : [];
  const evidenceReviewIds = Array.from(new Set(evidenceRaw.map((item) => toScopedEvidenceId(item)).filter(Boolean))).slice(
    0,
    BACKLOG_MAX_EVIDENCE_IDS
  );

  const appNamesRaw = Array.isArray(row.appNames) ? (row.appNames as unknown[]) : [];
  const appNames = Array.from(new Set(appNamesRaw.map((item) => normalizeText(String(item ?? ""))).filter(Boolean))).slice(
    0,
    20
  );

  const idSource = normalizeText(String(row.id ?? ""));
  const id = idSource || fallbackId;

  return {
    id,
    priority: normalizeBacklogPriority(row.priority),
    status: normalizeBacklogStatus(row.status),
    title: title.slice(0, 220),
    effort: normalizeBacklogLevel(row.effort),
    action: action.slice(0, 1_000),
    evidenceReviewIds,
    appNames
  };
}

function createDefaultBacklogState(ownerAppId: string): BacklogApiState {
  return {
    version: 2,
    ownerAppId,
    updatedAt: new Date().toISOString(),
    items: []
  };
}

function mergeSimilarBacklogItems(items: BacklogApiItem[]): BacklogApiItem[] {
  const grouped = new Map<string, BacklogApiItem>();
  const dedupeKeyToId = new Map<string, string>();

  for (const item of items) {
    const key = createBacklogSimilarityKey(item.title, item.action);
    const groupId = dedupeKeyToId.get(key) || item.id;
    if (!dedupeKeyToId.has(key)) {
      dedupeKeyToId.set(key, groupId);
    }

    const existing = grouped.get(groupId);
    if (!existing) {
      grouped.set(groupId, {
        ...item,
        id: groupId,
        title: sanitizeBacklogText(item.title).slice(0, 220),
        action: sanitizeBacklogAction(item.action).slice(0, 1_000),
        evidenceReviewIds: Array.from(new Set(item.evidenceReviewIds.map((id) => toScopedEvidenceId(id)).filter(Boolean))).slice(
          0,
          BACKLOG_MAX_EVIDENCE_IDS
        ),
        appNames: Array.from(new Set(item.appNames.map((name) => normalizeText(name)).filter(Boolean))).sort((a, b) =>
          a.localeCompare(b)
        )
      });
      continue;
    }

    const mergedEvidenceIds = Array.from(
      new Set([...existing.evidenceReviewIds, ...item.evidenceReviewIds].map((id) => toScopedEvidenceId(id)).filter(Boolean))
    ).slice(0, BACKLOG_MAX_EVIDENCE_IDS);
    const mergedAppNames = Array.from(
      new Set([...existing.appNames, ...item.appNames].map((name) => normalizeText(name)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    grouped.set(groupId, {
      ...existing,
      priority: backlogPriorityRank(item.priority) < backlogPriorityRank(existing.priority) ? item.priority : existing.priority,
      effort: backlogLevelRank(item.effort) > backlogLevelRank(existing.effort) ? item.effort : existing.effort,
      title: item.title.length > existing.title.length ? sanitizeBacklogText(item.title).slice(0, 220) : existing.title,
      action:
        sanitizeBacklogAction(item.action).length > sanitizeBacklogAction(existing.action).length
          ? sanitizeBacklogAction(item.action).slice(0, 1_000)
          : existing.action,
      evidenceReviewIds: mergedEvidenceIds,
      appNames: mergedAppNames
    });
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (backlogPriorityRank(a.priority) !== backlogPriorityRank(b.priority)) {
      return backlogPriorityRank(a.priority) - backlogPriorityRank(b.priority);
    }
    if (b.evidenceReviewIds.length !== a.evidenceReviewIds.length) {
      return b.evidenceReviewIds.length - a.evidenceReviewIds.length;
    }
    return a.title.localeCompare(b.title);
  });
}

function normalizeBacklogApiState(ownerAppId: string, value: unknown): BacklogApiState {
  if (!value || typeof value !== "object") {
    return createDefaultBacklogState(ownerAppId);
  }

  const source = value as Record<string, unknown>;
  const rawItems = Array.isArray(source.items) ? (source.items as unknown[]) : [];
  const items: BacklogApiItem[] = [];
  for (let index = 0; index < rawItems.length && index < BACKLOG_MAX_ITEMS; index += 1) {
    const normalized = normalizeBacklogApiItem(rawItems[index], `bg-${index + 1}`);
    if (!normalized) {
      continue;
    }

    items.push({
      ...normalized,
      evidenceReviewIds: normalized.evidenceReviewIds.map((id) => toScopedEvidenceId(id)).filter(Boolean),
      appNames: [...normalized.appNames].sort((a, b) => a.localeCompare(b))
    });
  }

  const mergedItems = mergeSimilarBacklogItems(items);

  return {
    version: 2,
    ownerAppId,
    updatedAt: normalizeText(typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString()),
    items: mergedItems
  };
}

function flattenLegacyBacklogToApiState(ownerAppId: string, value: unknown): BacklogApiState {
  if (!value || typeof value !== "object") {
    return createDefaultBacklogState(ownerAppId);
  }

  const source = value as Record<string, unknown>;
  const appBacklogs = Array.isArray(source.appBacklogs) ? (source.appBacklogs as unknown[]) : [];
  const grouped = new Map<
    string,
    {
      priority: BacklogPriority;
      status: BacklogStatus;
      effort: BacklogLevel;
      title: string;
      action: string;
      evidenceReviewIds: Set<string>;
      appNames: Set<string>;
    }
  >();

  for (const appBacklogRaw of appBacklogs) {
    if (!appBacklogRaw || typeof appBacklogRaw !== "object") {
      continue;
    }

    const appBacklog = appBacklogRaw as Record<string, unknown>;
    const appTitle = normalizeText(String(appBacklog.appTitle ?? ""));
    if (!appTitle) {
      continue;
    }
    const parsedTitle = parseBacklogAppTitle(appTitle);
    const appDisplayName = parsedTitle.displayName || appTitle;
    const appScope = resolveLegacyScopeToken(appTitle);
    const itemsRaw = Array.isArray(appBacklog.items) ? (appBacklog.items as unknown[]) : [];

    for (const itemRaw of itemsRaw) {
      if (!itemRaw || typeof itemRaw !== "object") {
        continue;
      }

      const item = itemRaw as Record<string, unknown>;
      const title = sanitizeBacklogText(item.title);
      const action = sanitizeBacklogAction(item.action);
      if (!title || !action) {
        continue;
      }

      const priority = normalizeBacklogPriority(item.priority);
      const status = normalizeBacklogStatus(item.status);
      const effort = normalizeBacklogLevel(item.effort);
      const rawEvidence = Array.isArray(item.evidenceReviewIds) ? (item.evidenceReviewIds as unknown[]) : [];
      const evidenceReviewIds = rawEvidence
        .map((entry) => {
          const baseReviewId = extractBaseReviewId(entry);
          if (!baseReviewId) {
            return "";
          }
          return toScopedEvidenceId(`${appScope}::${baseReviewId}`);
        })
        .filter(Boolean);

      const groupKey = createBacklogSimilarityKey(title, action);

      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, {
          priority,
          status,
          effort,
          title,
          action,
          evidenceReviewIds: new Set(evidenceReviewIds),
          appNames: new Set(appDisplayName ? [appDisplayName] : [])
        });
        continue;
      }

      evidenceReviewIds.forEach((id) => existing.evidenceReviewIds.add(id));
      if (appDisplayName) {
        existing.appNames.add(appDisplayName);
      }
    }
  }

  const items = Array.from(grouped.values()).map((item, index) => ({
    id: `bg-${index + 1}`,
    priority: item.priority,
    status: item.status,
    title: item.title,
    effort: item.effort,
    action: item.action,
    evidenceReviewIds: Array.from(item.evidenceReviewIds).slice(0, BACKLOG_MAX_EVIDENCE_IDS),
    appNames: Array.from(item.appNames).sort((a, b) => a.localeCompare(b))
  }));

  return normalizeBacklogApiState(ownerAppId, {
    version: 2,
    ownerAppId,
    updatedAt: normalizeText(typeof source.generatedAt === "string" ? source.generatedAt : new Date().toISOString()),
    items
  });
}

function parseBacklogFileToApiState(ownerAppId: string, value: unknown): BacklogApiState {
  if (!value || typeof value !== "object") {
    return createDefaultBacklogState(ownerAppId);
  }

  const source = value as Record<string, unknown>;
  const hasItems = Array.isArray(source.items);
  if (hasItems) {
    return normalizeBacklogApiState(ownerAppId, source);
  }
  if (Array.isArray(source.appBacklogs)) {
    return flattenLegacyBacklogToApiState(ownerAppId, source);
  }
  return createDefaultBacklogState(ownerAppId);
}

async function readBacklogState(dataRoot: string, ownerAppId: string): Promise<BacklogApiState> {
  const target = backlogPath(dataRoot, ownerAppId);
  try {
    const raw = await fs.readFile(target, "utf8");
    return parseBacklogFileToApiState(ownerAppId, JSON.parse(raw) as unknown);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code !== "ENOENT") {
      throw error;
    }
  }
  return createDefaultBacklogState(ownerAppId);
}

function convertApiStateToBacklogData(ownerAppId: string, state: BacklogApiState): BacklogDataFile {
  return {
    version: 2,
    ownerAppId,
    updatedAt: state.updatedAt || new Date().toISOString(),
    items: state.items.map((item) => ({
      id: item.id,
      priority: item.priority,
      status: item.status,
      title: item.title,
      effort: item.effort,
      action: item.action,
      evidenceReviewIds: Array.from(new Set(item.evidenceReviewIds.map((id) => toScopedEvidenceId(id)).filter(Boolean))),
      appNames: Array.from(new Set(item.appNames.map((name) => normalizeText(name)).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      )
    }))
  };
}

async function writeBacklogState(dataRoot: string, state: BacklogApiState): Promise<void> {
  const target = backlogPath(dataRoot, state.ownerAppId);
  const payload = convertApiStateToBacklogData(state.ownerAppId, state);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(payload, null, 2), "utf8");
}

function resolveAppIdFromBacklogPath(pathname: string): string | undefined {
  if (!pathname.startsWith(BACKLOG_API_PREFIX)) {
    return undefined;
  }

  const tail = pathname.slice(BACKLOG_API_PREFIX.length);
  if (!tail || tail.includes("/")) {
    return undefined;
  }

  return normalizeText(decodeURIComponent(tail));
}

export async function handleBacklogApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  context: ApiRouteContext
): Promise<boolean> {
  if (!pathname.startsWith(BACKLOG_API_PREFIX)) {
    return false;
  }

  const ownerAppId = resolveAppIdFromBacklogPath(pathname);
  if (!ownerAppId || !isSafeAppId(ownerAppId)) {
    sendNotFound(res);
    return true;
  }

  if (context.filterAppId && ownerAppId !== context.filterAppId) {
    sendNotFound(res);
    return true;
  }

  if (req.method === "GET") {
    const state = await readBacklogState(context.dataRoot, ownerAppId);
    sendJson(res, state);
    return true;
  }

  if (req.method !== "PUT") {
    sendMethodNotAllowed(res, ["GET", "PUT"]);
    return true;
  }

  try {
    const bodyRaw = await readRequestBody(req, BACKLOG_MAX_BODY_BYTES);
    const payload = bodyRaw ? (JSON.parse(bodyRaw) as unknown) : {};
    const normalized = normalizeBacklogApiState(ownerAppId, payload);
    const nextState: BacklogApiState = {
      ...normalized,
      ownerAppId,
      updatedAt: new Date().toISOString()
    };
    await writeBacklogState(context.dataRoot, nextState);
    sendJson(res, nextState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, { ok: false, error: message }, 400);
  }

  return true;
}
