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

interface BacklogApiItem {
  id: string;
  priority: BacklogPriority;
  title: string;
  impact: BacklogLevel;
  effort: BacklogLevel;
  action: string;
  evidenceReviewIds: string[];
  appNames: string[];
}

interface BacklogApiState {
  version: 1;
  ownerAppId: string;
  updatedAt: string;
  items: BacklogApiItem[];
}

interface BacklogDataItem {
  priority: BacklogPriority;
  title: string;
  impact: BacklogLevel;
  effort: BacklogLevel;
  action: string;
  evidenceCount: number;
  evidenceReviewIds: string[];
}

interface BacklogDataApp {
  appTitle: string;
  reviewCount: string;
  items: BacklogDataItem[];
}

interface BacklogDataFile {
  version: 1;
  ownerAppId: string;
  generatedAt: string;
  appBacklogs: BacklogDataApp[];
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

function toBaseReviewId(value: unknown): string {
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
  const title = normalizeText(String(row.title ?? ""));
  const action = normalizeText(String(row.action ?? ""));
  if (!title || !action) {
    return undefined;
  }

  const evidenceRaw = Array.isArray(row.evidenceReviewIds) ? (row.evidenceReviewIds as unknown[]) : [];
  const evidenceReviewIds = Array.from(
    new Set(evidenceRaw.map((item) => toBaseReviewId(item)).filter(Boolean))
  ).slice(0, BACKLOG_MAX_EVIDENCE_IDS);

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
    title: title.slice(0, 220),
    impact: normalizeBacklogLevel(row.impact),
    effort: normalizeBacklogLevel(row.effort),
    action: action.slice(0, 1_000),
    evidenceReviewIds,
    appNames
  };
}

function createDefaultBacklogState(ownerAppId: string): BacklogApiState {
  return {
    version: 1,
    ownerAppId,
    updatedAt: new Date().toISOString(),
    items: []
  };
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
      evidenceReviewIds: normalized.evidenceReviewIds.map((id) => toBaseReviewId(id)).filter(Boolean),
      appNames: [...normalized.appNames].sort((a, b) => a.localeCompare(b))
    });
  }

  items.sort((a, b) => {
    if (backlogPriorityRank(a.priority) !== backlogPriorityRank(b.priority)) {
      return backlogPriorityRank(a.priority) - backlogPriorityRank(b.priority);
    }
    if (b.evidenceReviewIds.length !== a.evidenceReviewIds.length) {
      return b.evidenceReviewIds.length - a.evidenceReviewIds.length;
    }
    return a.title.localeCompare(b.title);
  });

  return {
    version: 1,
    ownerAppId,
    updatedAt: normalizeText(typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString()),
    items
  };
}

function flattenBacklogDataToApiState(ownerAppId: string, value: unknown): BacklogApiState {
  if (!value || typeof value !== "object") {
    return createDefaultBacklogState(ownerAppId);
  }

  const source = value as Record<string, unknown>;
  const appBacklogs = Array.isArray(source.appBacklogs) ? (source.appBacklogs as unknown[]) : [];
  const grouped = new Map<
    string,
    {
      priority: BacklogPriority;
      impact: BacklogLevel;
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
    const appDisplayName = parseBacklogAppTitle(appTitle).displayName || appTitle;
    const itemsRaw = Array.isArray(appBacklog.items) ? (appBacklog.items as unknown[]) : [];

    for (const itemRaw of itemsRaw) {
      if (!itemRaw || typeof itemRaw !== "object") {
        continue;
      }

      const item = itemRaw as Record<string, unknown>;
      const title = normalizeText(String(item.title ?? ""));
      const action = normalizeText(String(item.action ?? ""));
      if (!title || !action) {
        continue;
      }

      const priority = normalizeBacklogPriority(item.priority);
      const impact = normalizeBacklogLevel(item.impact);
      const effort = normalizeBacklogLevel(item.effort);
      const rawEvidence = Array.isArray(item.evidenceReviewIds) ? (item.evidenceReviewIds as unknown[]) : [];
      const evidenceReviewIds = rawEvidence
        .map((value) => toBaseReviewId(value))
        .filter(Boolean);

      const groupKey = [priority, impact, effort, title.toLowerCase(), action.toLowerCase()].join("||");

      const existing = grouped.get(groupKey);
      if (!existing) {
        grouped.set(groupKey, {
          priority,
          impact,
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
    title: item.title,
    impact: item.impact,
    effort: item.effort,
    action: item.action,
    evidenceReviewIds: Array.from(item.evidenceReviewIds).slice(0, BACKLOG_MAX_EVIDENCE_IDS),
    appNames: Array.from(item.appNames).sort((a, b) => a.localeCompare(b))
  }));

  return normalizeBacklogApiState(ownerAppId, {
    version: 1,
    ownerAppId,
    updatedAt: normalizeText(typeof source.generatedAt === "string" ? source.generatedAt : new Date().toISOString()),
    items
  });
}

async function readBacklogState(dataRoot: string, ownerAppId: string): Promise<BacklogApiState> {
  const target = backlogPath(dataRoot, ownerAppId);
  try {
    const raw = await fs.readFile(target, "utf8");
    return flattenBacklogDataToApiState(ownerAppId, JSON.parse(raw) as unknown);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code !== "ENOENT") {
      throw error;
    }
  }
  return createDefaultBacklogState(ownerAppId);
}

function convertApiStateToBacklogData(ownerAppId: string, state: BacklogApiState): BacklogDataFile {
  const appBacklogs = new Map<string, BacklogDataApp>();

  for (const item of state.items) {
    const baseEvidenceIds = Array.from(
      new Set(item.evidenceReviewIds.map((id) => toBaseReviewId(id)).filter(Boolean))
    ).slice(0, BACKLOG_MAX_EVIDENCE_IDS);

    const targetAppTitles: string[] =
      item.appNames.length > 0 ? item.appNames : ["global"];

    targetAppTitles.forEach((appTitle) => {
      const normalizedTitle = normalizeText(appTitle) || "global";
      const current = appBacklogs.get(normalizedTitle) ?? {
        appTitle: normalizedTitle,
        reviewCount: "-",
        items: []
      };
      if (!appBacklogs.has(normalizedTitle)) {
        appBacklogs.set(normalizedTitle, current);
      }

      current.items.push({
        priority: item.priority,
        title: item.title,
        impact: item.impact,
        effort: item.effort,
        action: item.action,
        evidenceCount: baseEvidenceIds.length,
        evidenceReviewIds: baseEvidenceIds
      });
    });
  }

  return {
    version: 1,
    ownerAppId,
    generatedAt: new Date().toISOString(),
    appBacklogs: Array.from(appBacklogs.values()).sort((a, b) => a.appTitle.localeCompare(b.appTitle))
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
