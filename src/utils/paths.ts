import path from "node:path";
import { OutputPaths } from "./types";
import { normalizeText, safeFileName } from "./text";

export function resolvePathFromCwd(...segments: string[]): string {
  return path.resolve(process.cwd(), ...segments);
}

export function resolvePathOrDefault(inputPath: string | undefined | null, defaultPath: string): string {
  if (normalizeText(inputPath)) {
    return resolvePathFromCwd(String(inputPath));
  }

  return defaultPath;
}

export function resolveOwnerDataPath(ownerAppId: string, ...segments: string[]): string {
  return resolvePathFromCwd("data", ownerAppId, ...segments);
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

