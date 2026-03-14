import { promises as fs } from "node:fs";
import path from "node:path";
import fetch, { RequestInit } from "node-fetch";

export type ReviewSource = "play" | "ios";

export const DEFAULT_REVIEW_LIMIT = 200;
export const MIN_REVIEW_TEXT_LENGTH_EXCLUSIVE = 10;
const FETCH_TIMEOUT_MS = 15_000;

export interface ReviewItem {
  rating: number;
  text: string;
  date: string;
  user: string;
}

export interface SourceReviewResult {
  source: ReviewSource;
  reviews: ReviewItem[];
}

export interface UnifiedReview extends ReviewItem {
  source: ReviewSource;
}

export interface ReviewsOutput {
  ownerAppId: string;
  app: string;
  appName: string;
  collectedAt: string;
  limitPerStore: number;
  ids: {
    play?: string;
    ios?: string;
  };
  links: {
    play?: string;
    ios?: string;
  };
  counts: {
    play: number;
    ios: number;
    total: number;
  };
  reviews: UnifiedReview[];
}

export interface AppTarget {
  name: string;
  displayName?: string;
  play?: string;
  ios?: string;
}

export interface OutputPaths {
  reviewsPath: string;
}

export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function normalizeText(input: string | undefined | null): string {
  return (input ?? "").replace(/\s+/g, " ").trim();
}

export function hasMeaningfulReviewText(input: string | undefined | null): boolean {
  return normalizeText(input).length > MIN_REVIEW_TEXT_LENGTH_EXCLUSIVE;
}

export function toIsoString(input: string | Date | undefined | null): string {
  if (!input) {
    return new Date().toISOString();
  }

  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

export function safeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "app"
  );
}

export function createOutputPaths(baseDir: string, ownerAppId: string, appName: string): OutputPaths {
  const safeName = safeFileName(appName);
  const safeOwnerId = safeFileName(ownerAppId);

  return {
    reviewsPath: path.resolve(baseDir, "data", safeOwnerId, "reviews", `${safeName}.json`)
  };
}

export function createPlayStoreAppUrl(appId: string | undefined): string | undefined {
  const normalized = normalizeText(appId);
  if (!normalized) {
    return undefined;
  }

  return `https://play.google.com/store/apps/details?id=${encodeURIComponent(normalized)}`;
}

export function createAppStoreAppUrl(appId: string | undefined): string | undefined {
  const normalized = normalizeText(appId);
  if (!normalized) {
    return undefined;
  }

  return `https://apps.apple.com/app/id${encodeURIComponent(normalized)}`;
}

export function dedupeReviews(reviews: UnifiedReview[]): UnifiedReview[] {
  const seen = new Set<string>();
  const result: UnifiedReview[] = [];

  for (const review of reviews) {
    const key = [review.source, review.user, review.date, review.text].join("::");
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(review);
  }

  return result;
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function removeFileIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError?.code !== "ENOENT") {
      throw error;
    }
  }
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function requestWithRetry<T>(
  url: string,
  parser: (response: Awaited<ReturnType<typeof fetch>>) => Promise<T>,
  options?: RequestInit,
  retries = 3,
  retryDelayMs = 500
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const requestOptions: RequestInit = {
        ...(options ?? {})
      };
      let timeoutHandle: NodeJS.Timeout | undefined;

      if (!requestOptions.signal) {
        const controller = new AbortController();
        timeoutHandle = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        requestOptions.signal = controller.signal;
      }

      const response = await fetch(url, requestOptions);
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }

      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(`Request failed (${response.status}) for ${url}. ${body}`);
      }

      return await parser(response);
    } catch (error) {
      lastError = error;

      if (attempt < retries - 1) {
        await sleep(retryDelayMs * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error");
}

export async function fetchJsonWithRetry<T>(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<T> {
  return requestWithRetry<T>(url, async (response) => (await response.json()) as T, options, retries);
}

export async function fetchTextWithRetry(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<string> {
  return requestWithRetry<string>(url, async (response) => await response.text(), options, retries);
}

export function createAppLogger(appName: string) {
  const prefix = `[${appName}]`;
  return {
    info(message: string): void {
      console.log(`${prefix} ${message}`);
    },
    warn(message: string): void {
      console.warn(`${prefix} ${message}`);
    },
    error(message: string): void {
      console.error(`${prefix} ${message}`);
    }
  };
}
