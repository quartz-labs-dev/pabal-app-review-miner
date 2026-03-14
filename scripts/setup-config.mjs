#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import { access, chmod, mkdir, readdir, readFile, writeFile } from "node:fs/promises";

const configDir = path.join(os.homedir(), ".config", "pabal-mcp");
const configPath = path.join(configDir, "registered-apps.json");

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

  const hasFile = await exists(configPath);

  if (!hasFile) {
    await writeFile(configPath, `${JSON.stringify(template, null, 2)}\n`, "utf8");
    console.log(`Created: ${configPath}`);
  } else {
    const raw = await readFile(configPath, "utf8");
    try {
      JSON.parse(raw);
      console.log(`Exists and valid JSON: ${configPath}`);
    } catch {
      console.warn(`Exists but invalid JSON: ${configPath}`);
      console.warn("Please fix the file manually.");
    }
  }

  await lockConfigFilePermissions();

  console.log(`Config dir: ${configDir}`);
  console.log("Next: update app entries and run the CLI with --my-app.");
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`setup-config failed: ${message}`);
  process.exit(1);
});
