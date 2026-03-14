import { promises as fs } from "node:fs";
import path from "node:path";
import fetch, { RequestInit } from "node-fetch";

export type ReviewSource = "play" | "ios";

export const DEFAULT_REVIEW_LIMIT = 200;

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
  collectedAt: string;
  limitPerStore: number;
  ids: {
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

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

export async function fetchJsonWithRetry<T>(
  url: string,
  options?: RequestInit,
  retries = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const body = (await response.text()).slice(0, 300);
        throw new Error(`Request failed (${response.status}) for ${url}. ${body}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      if (attempt < retries - 1) {
        await sleep(500 * (attempt + 1));
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unknown fetch error");
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
