import { promises as fs } from "node:fs";
import path from "node:path";
import { IncomingMessage, ServerResponse } from "node:http";
import { normalizeText } from "../utils";
import { readRequestBody, sendJson, sendMethodNotAllowed, sendNotFound } from "./httpUtils";
import { ApiRouteContext } from "./types";

export const PREVIEW_STATE_FILE_NAME = "preview-state.json";
export const PREVIEW_STATE_API_PREFIX = "/api/preview-state/";

const PREVIEW_STATE_MAX_BODY_BYTES = 25_000_000;
const PREVIEW_STATE_MAX_REVIEWS = 200_000;
const PREVIEW_STATE_MAX_NOTES = 2_000;
const PREVIEW_STATE_MAX_NOTE_LENGTH = 20_000;

type PreviewTag = "heart" | "satisfaction" | "dissatisfaction" | "requests";

interface PreviewStateEntry {
  excluded: boolean;
  tags: PreviewTag[];
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
  reviews: Record<string, PreviewStateEntry>;
  backlogNotes: Record<string, BacklogNoteEntry>;
}

const PREVIEW_TAG_SET = new Set<PreviewTag>(["heart", "satisfaction", "dissatisfaction", "requests"]);

function isSafeAppId(appId: string): boolean {
  return /^[a-z0-9._-]+$/i.test(appId);
}

function isSafeReviewId(reviewId: string): boolean {
  return /^[a-z0-9._:-]+$/i.test(reviewId) && reviewId.length <= 180;
}

function isSafeNoteBacklogKey(backlogId: string): boolean {
  return /^[a-z0-9._:-]+$/i.test(backlogId) && backlogId.length <= 180;
}

function createDefaultPreviewState(ownerAppId: string): PreviewStateFile {
  return {
    version: 3,
    ownerAppId,
    updatedAt: new Date().toISOString(),
    reviews: {},
    backlogNotes: {}
  };
}

function normalizePreviewTags(value: unknown): PreviewTag[] {
  const source = Array.isArray(value) ? value : [];
  const ordered: PreviewTag[] = [];
  const seen = new Set<PreviewTag>();

  for (const item of source) {
    const candidate = normalizeText(String(item ?? "")).toLowerCase() as PreviewTag;
    if (!PREVIEW_TAG_SET.has(candidate) || seen.has(candidate)) {
      continue;
    }
    seen.add(candidate);
    ordered.push(candidate);
  }

  return ordered;
}

function normalizePreviewStateEntry(value: unknown): PreviewStateEntry | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const row = value as Record<string, unknown>;
  return {
    excluded: Boolean(row.excluded),
    tags: normalizePreviewTags(row.tags),
    updatedAt: normalizeText(typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString())
  };
}

function normalizeBacklogNoteEntry(value: unknown): BacklogNoteEntry | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const row = value as Record<string, unknown>;
  const contentSource = typeof row.content === "string" ? row.content : "";
  const content = contentSource.replace(/\r\n?/g, "\n").replace(/\u0000/g, "").trim();
  if (!content) {
    return undefined;
  }

  return {
    content: content.slice(0, PREVIEW_STATE_MAX_NOTE_LENGTH),
    updatedAt: normalizeText(typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString())
  };
}

function normalizePreviewState(ownerAppId: string, value: unknown): PreviewStateFile {
  const fallback = createDefaultPreviewState(ownerAppId);
  if (!value || typeof value !== "object") {
    return fallback;
  }

  const source = value as Record<string, unknown>;
  const rawReviews =
    source.reviews && typeof source.reviews === "object" ? (source.reviews as Record<string, unknown>) : {};
  const rawBacklogNotes =
    source.backlogNotes && typeof source.backlogNotes === "object"
      ? (source.backlogNotes as Record<string, unknown>)
      : {};

  const reviews: Record<string, PreviewStateEntry> = {};
  const backlogNotes: Record<string, BacklogNoteEntry> = {};

  const reviewPairs = Object.entries(rawReviews).slice(0, PREVIEW_STATE_MAX_REVIEWS);
  for (const [reviewIdRaw, reviewStateRaw] of reviewPairs) {
    const reviewId = normalizeText(reviewIdRaw);
    if (!reviewId || !isSafeReviewId(reviewId)) {
      continue;
    }

    const normalized = normalizePreviewStateEntry(reviewStateRaw);
    if (!normalized) {
      continue;
    }

    reviews[reviewId] = normalized;
  }

  const notePairs = Object.entries(rawBacklogNotes).slice(0, PREVIEW_STATE_MAX_NOTES);
  for (const [backlogIdRaw, backlogNoteRaw] of notePairs) {
    const backlogId = normalizeText(backlogIdRaw);
    if (!backlogId || !isSafeNoteBacklogKey(backlogId)) {
      continue;
    }

    const normalized = normalizeBacklogNoteEntry(backlogNoteRaw);
    if (!normalized) {
      continue;
    }

    backlogNotes[backlogId] = normalized;
  }

  return {
    version: 3,
    ownerAppId,
    updatedAt: normalizeText(typeof source.updatedAt === "string" ? source.updatedAt : new Date().toISOString()),
    reviews,
    backlogNotes
  };
}

function previewStatePath(dataRoot: string, ownerAppId: string): string {
  return path.resolve(dataRoot, ownerAppId, "reports", PREVIEW_STATE_FILE_NAME);
}

async function readPreviewState(dataRoot: string, ownerAppId: string): Promise<PreviewStateFile> {
  const statePath = previewStatePath(dataRoot, ownerAppId);

  try {
    const raw = await fs.readFile(statePath, "utf8");
    return normalizePreviewState(ownerAppId, JSON.parse(raw) as unknown);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code !== "ENOENT") {
      throw error;
    }
  }

  return createDefaultPreviewState(ownerAppId);
}

async function writePreviewState(dataRoot: string, state: PreviewStateFile): Promise<void> {
  const statePath = previewStatePath(dataRoot, state.ownerAppId);
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify(state, null, 2), "utf8");
}

function resolveAppIdFromStatePath(pathname: string): string | undefined {
  if (!pathname.startsWith(PREVIEW_STATE_API_PREFIX)) {
    return undefined;
  }

  const tail = pathname.slice(PREVIEW_STATE_API_PREFIX.length);
  if (!tail || tail.includes("/")) {
    return undefined;
  }

  return normalizeText(decodeURIComponent(tail));
}

export async function handlePreviewStateApi(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  context: ApiRouteContext
): Promise<boolean> {
  if (!pathname.startsWith(PREVIEW_STATE_API_PREFIX)) {
    return false;
  }

  const ownerAppId = resolveAppIdFromStatePath(pathname);
  if (!ownerAppId || !isSafeAppId(ownerAppId)) {
    sendNotFound(res);
    return true;
  }

  if (context.filterAppId && ownerAppId !== context.filterAppId) {
    sendNotFound(res);
    return true;
  }

  if (req.method === "GET") {
    const state = await readPreviewState(context.dataRoot, ownerAppId);
    sendJson(res, state);
    return true;
  }

  if (req.method !== "PUT") {
    sendMethodNotAllowed(res, ["GET", "PUT"]);
    return true;
  }

  try {
    const bodyRaw = await readRequestBody(req, PREVIEW_STATE_MAX_BODY_BYTES);
    const payload = bodyRaw ? (JSON.parse(bodyRaw) as unknown) : {};
    const normalized = normalizePreviewState(ownerAppId, payload);
    const nextState: PreviewStateFile = {
      ...normalized,
      ownerAppId,
      updatedAt: new Date().toISOString()
    };
    await writePreviewState(context.dataRoot, nextState);
    sendJson(res, nextState);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendJson(res, { ok: false, error: message }, 400);
  }

  return true;
}
