#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import { access, chmod, copyFile, mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const configDir = path.join(os.homedir(), ".config", "pabal-mcp");
const registeredAppsPath = path.join(configDir, "registered-apps.json");
const storeApiConfigPath = path.join(configDir, "config.json");
const localDataDir = path.resolve(process.cwd(), "data");

const template = {
  apps: [
    {
      slug: "golden-horizon",
      name: "Golden Horizon",
      appStore: {
        bundleId: "com.quartz.goldenhorizon",
        appId: "1234567890",
        name: "Golden Horizon",
        supportedLocales: ["en-US", "ko-KR"]
      },
      googlePlay: {
        packageName: "com.quartz.goldenhorizon",
        name: "Golden Horizon",
        supportedLocales: ["en-US", "ko-KR"]
      }
    }
  ]
};

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJsonStatus(filePath) {
  const hasFile = await exists(filePath);

  if (!hasFile) {
    return { hasFile: false, isValid: false };
  }

  const raw = await readFile(filePath, "utf8");

  try {
    JSON.parse(raw);
    return { hasFile: true, isValid: true };
  } catch {
    return { hasFile: true, isValid: false };
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function syncPabalWebAppIcons(storeApiConfig) {
  const dataDir =
    storeApiConfig && typeof storeApiConfig.dataDir === "string" ? storeApiConfig.dataDir.trim() : "";

  if (!dataDir) {
    return;
  }

  const productsDir = path.resolve(dataDir, "public", "products");
  const entries = await readdir(productsDir, { withFileTypes: true }).catch(() => undefined);

  if (!entries) {
    console.log(`pabal-web products directory not found: ${productsDir}`);
    return;
  }

  let copied = 0;
  let missing = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const slug = entry.name;
    const iconCandidates = [path.join(productsDir, slug, "icon.png"), path.join(productsDir, slug, "icons", "icon.png")];
    let sourceIconPath;

    for (const candidate of iconCandidates) {
      if (await exists(candidate)) {
        sourceIconPath = candidate;
        break;
      }
    }

    if (!sourceIconPath) {
      missing += 1;
      continue;
    }

    const targetAppDir = path.join(localDataDir, slug);
    const targetIconPath = path.join(targetAppDir, "icon.png");
    await mkdir(targetAppDir, { recursive: true });
    await copyFile(sourceIconPath, targetIconPath);
    copied += 1;
  }

  if (copied > 0) {
    console.log(`Synced pabal-web app icons: ${copied} file(s) -> ${localDataDir}/{appId}/icon.png`);
  } else {
    console.log(`No icon.png files found to sync under: ${productsDir}`);
  }

  if (missing > 0) {
    console.log(`Skipped products without icon.png: ${missing}`);
  }
}

async function lockConfigFilePermissions() {
  let changed = 0;

  try {
    const entries = await readdir(configDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const entryPath = path.join(configDir, entry.name);

      try {
        await chmod(entryPath, 0o600);
        changed += 1;
      } catch {
        // Ignore per-file chmod failures and continue.
      }
    }
  } catch {
    // Ignore listing failures and continue.
  }

  if (changed > 0) {
    console.log(`Locked file permissions (600): ${changed} file(s)`);
  }
}

async function run() {
  await mkdir(configDir, { recursive: true });

  // Best effort: some environments may not allow chmod.
  try {
    await chmod(configDir, 0o700);
  } catch {
    // Ignore chmod failures and continue.
  }

  const storeApiStatus = await readJsonStatus(storeApiConfigPath);
  const registeredStatus = await readJsonStatus(registeredAppsPath);
  const storeApiConfig =
    storeApiStatus.hasFile && storeApiStatus.isValid ? await readJson(storeApiConfigPath) : undefined;

  if (storeApiStatus.hasFile && storeApiStatus.isValid && registeredStatus.hasFile && registeredStatus.isValid) {
    console.log(`Detected existing pabal-store-api-mcp config: ${storeApiConfigPath}`);
    console.log(`Detected existing registered-apps.json: ${registeredAppsPath}`);
    console.log("Skip manual bootstrap (recommended path).");
    await syncPabalWebAppIcons(storeApiConfig);
    await lockConfigFilePermissions();
    console.log(`Config dir: ${configDir}`);
    return;
  }

  if (!registeredStatus.hasFile) {
    await writeFile(registeredAppsPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
    console.log(`Created: ${registeredAppsPath}`);
  } else {
    if (registeredStatus.isValid) {
      console.log(`Exists and valid JSON: ${registeredAppsPath}`);
    } else {
      console.warn(`Exists but invalid JSON: ${registeredAppsPath}`);
      console.warn("Please fix the file manually.");
    }
  }

  if (!storeApiStatus.hasFile) {
    console.log(`pabal-store-api-mcp config not found: ${storeApiConfigPath}`);
    console.log("Fallback to local manual bootstrap for registered-apps.json.");
  } else if (!storeApiStatus.isValid) {
    console.warn(`pabal-store-api-mcp config exists but invalid JSON: ${storeApiConfigPath}`);
    console.warn("Please fix config.json manually if you want to use the recommended path.");
  }

  await syncPabalWebAppIcons(storeApiConfig);
  await lockConfigFilePermissions();

  console.log(`Config dir: ${configDir}`);
  console.log("Next: update app entries and run the CLI with --my-app.");
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`setup-icon failed: ${message}`);
  process.exit(1);
});
