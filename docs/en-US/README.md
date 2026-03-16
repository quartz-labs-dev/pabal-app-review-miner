# pabal-app-review-miner Docs (en-US)

## Overview

`pabal-app-review-miner` is a CLI for collecting raw competitor reviews from Google Play and App Store, grouped by your app id.

## What It Does

- Collects newest reviews from Google Play and App Store
- Supports single competitor and multi competitor workflows
- Auto-discovers top competitors when only `--my-app` is provided
- Saves raw JSON per competitor under your app scope
- Adds stable `reviewId` (and optional `storeReviewId`) per review item for dedupe/linking
- Translates collected reviews to Korean under `reviews-ko/`
- Generates Korean competitor analysis reports under `reports/`

Output structure:

- `data/{myAppId}/reviews/{competitor}.json`

## Quick Start

```bash
npm install
npm run build
npm run setup:icon
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200 --append-existing
npm run review:collect -- --my-app golden-horizon --auto-top 5 --limit 200
npm run review:collect -- --my-app golden-horizon --apps apps.json --platform ios --limit 200
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy"
npm run review:backfill-ids -- --my-app golden-horizon
npm run report:translate -- --my-app golden-horizon
npm run report:analyze -- --my-app golden-horizon
npm run report:render-html -- --my-app golden-horizon
npm run report:preview -- --my-app golden-horizon --port 4173
```

`setup:icon` skips manual bootstrap when `pabal-store-api-mcp` is already configured.

## Setup

### 1. Install

Runtime requirement:

- Node.js `>=20.19.0`

```bash
npm install
npm run build
```

### 2. Prepare `registered-apps.json`

This project resolves `myAppId` from:

- `~/.config/pabal-mcp/registered-apps.json`

Recommended: Reuse existing `pabal-store-api-mcp` setup

```bash
npm run setup:icon
```

If these files already exist and are valid, the command skips manual bootstrap:

- `~/.config/pabal-mcp/config.json`
- `~/.config/pabal-mcp/registered-apps.json`

Fallback: local bootstrap (same behavior as before)

```bash
npm run setup:icon
```

This command:
- creates `~/.config/pabal-mcp`
- applies `chmod 700` (best effort)
- creates `registered-apps.json` with a starter template if missing
- locks file permissions to `600` for files in `~/.config/pabal-mcp`
- if `~/.config/pabal-mcp/config.json` has `dataDir` and pabal-web exists, syncs product icons (`public/products/*/icons/icon.png`, with `public/products/*/icon.png` fallback) into this project at `data/{appId}/icon.png` for dashboard and report screens

Manual quick add (if not set up yet)

```bash
mkdir -p ~/.config/pabal-mcp
chmod 700 ~/.config/pabal-mcp
cat > ~/.config/pabal-mcp/registered-apps.json <<'JSON'
{
  "apps": [
    {
      "slug": "golden-horizon",
      "name": "Golden Horizon",
      "appStore": {
        "bundleId": "com.quartz.goldenhorizon",
        "appId": "1234567890",
        "name": "Golden Horizon",
        "supportedLocales": ["en-US", "ko-KR"]
      },
      "googlePlay": {
        "packageName": "com.quartz.goldenhorizon",
        "name": "Golden Horizon",
        "supportedLocales": ["en-US", "ko-KR"]
      }
    }
  ]
}
JSON
open ~/.config/pabal-mcp
chmod 600 ~/.config/pabal-mcp/*
```

### 🔐 Configure Credentials

`pabal-resource-mcp` uses the configuration file from `pabal-store-api-mcp`. For detailed credential setup instructions (App Store Connect API keys, Google Play service accounts, etc.), see the [pabal-store-api-mcp README](https://pabal.quartz.best/docs/pabal-store-api-mcp/README).

### 3. JSON Rules

- Minimum required field per app is `slug`.
- `--my-app` can match `slug`, `name`, `appStore.bundleId`, `appStore.appId`, or `googlePlay.packageName`.
- Keep `slug` stable because it is used as `{myAppId}` in output paths.
- Auto competitor discovery (`--my-app` only mode) requires at least one of `googlePlay.packageName` or `appStore.appId`.

### 4. Optional Custom Path

```bash
--registered-apps-path /your/path/registered-apps.json
```

### 5. Quick Validation

```bash
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 1
```

## Documentation Map

- [Review Commands](./review.md): `review:*` scripts
- [Report Commands](./report.md): `report:*` scripts
