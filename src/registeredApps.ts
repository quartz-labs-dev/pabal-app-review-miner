import os from "node:os";
import path from "node:path";
import { readJsonFile, resolvePathOrDefault } from "./utils";

export const DEFAULT_REGISTERED_APPS_PATH = path.join(
  os.homedir(),
  ".config",
  "pabal-mcp",
  "registered-apps.json"
);

interface RegisteredAppEntry {
  slug?: string;
  name?: string;
  appStore?: {
    bundleId?: string;
    appId?: string;
  };
  googlePlay?: {
    packageName?: string;
  };
}

interface RegisteredAppsFile {
  apps?: RegisteredAppEntry[];
}

export interface ResolvedOwnerApp {
  ownerAppId: string;
  name?: string;
  play?: string;
  ios?: string;
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function matchesQuery(app: RegisteredAppEntry, query: string): boolean {
  const q = normalize(query);
  if (!q) {
    return false;
  }

  return (
    normalize(app.slug) === q ||
    normalize(app.name) === q ||
    normalize(app.appStore?.bundleId) === q ||
    normalize(app.appStore?.appId) === q ||
    normalize(app.googlePlay?.packageName) === q
  );
}

export async function resolveOwnerAppId(query: string, filePath?: string): Promise<string> {
  const owner = await resolveOwnerApp(query, filePath);
  return owner.ownerAppId;
}

export async function resolveOwnerApp(query: string, filePath?: string): Promise<ResolvedOwnerApp> {
  const registeredPath = resolvePathOrDefault(filePath, DEFAULT_REGISTERED_APPS_PATH);

  const payload = await readJsonFile<RegisteredAppsFile>(registeredPath);
  const apps = payload.apps ?? [];

  if (!apps.length) {
    throw new Error(`No apps found in ${registeredPath}`);
  }

  const found = apps.find((app) => matchesQuery(app, query));
  if (!found?.slug) {
    const available = apps
      .map((app) => app.slug)
      .filter((slug): slug is string => Boolean(slug))
      .slice(0, 10);

    throw new Error(
      `Cannot find my app id for "${query}" in ${registeredPath}. ` +
        `Try one of: ${available.join(", ")}`
    );
  }

  return {
    ownerAppId: found.slug,
    name: found.name,
    play: found.googlePlay?.packageName,
    ios: found.appStore?.appId
  };
}
