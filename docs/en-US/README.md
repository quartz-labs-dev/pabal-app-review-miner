# pabal-app-review-miner Docs (en-US)

## Overview

`pabal-app-review-miner` is a CLI for collecting raw competitor reviews from Google Play and App Store, grouped by your app id.

## What It Does

- Collects newest reviews from Google Play and App Store
- Supports single competitor and multi competitor workflows
- Auto-discovers top competitors when only `--my-app` is provided
- Saves raw JSON per competitor under your app scope

Output structure:

- `data/{myAppId}/reviews/{competitor}.json`

## Quick Start

```bash
npm install
npm run build
node dist/cli.js --my-app golden-horizon --apps apps.json --limit 200
node dist/cli.js --my-app golden-horizon --auto-top 5 --limit 200
```

## Documentation Map

- [Setup](./setup.md): prerequisites and `registered-apps.json` preparation
- [Usage](./usage.md): CLI options, commands, and output format
