# pabal-app-review-miner Docs (en-US)

## Overview

`pabal-app-review-miner` is a CLI for collecting raw competitor reviews from Google Play and App Store, grouped by your app id.

## What It Does

- Collects newest reviews from Google Play and App Store
- Supports single competitor and multi competitor workflows
- Auto-discovers top competitors when only `--my-app` is provided
- Saves raw JSON per competitor under your app scope
- Translates collected reviews to Korean under `reviews-ko/`
- Generates Korean competitor analysis reports under `reports/`

Output structure:

- `data/{myAppId}/reviews/{competitor}.json`

## Quick Start

```bash
npm install
npm run build
npm run setup:config
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --limit 200
npm run collect-reviews -- --my-app golden-horizon --auto-top 5 --limit 200
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --platform ios --limit 200
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy"
npm run translate-reviews -- --my-app golden-horizon
npm run analyze-competitors -- --my-app golden-horizon
npm run render-report-html -- --my-app golden-horizon
npm run preview-report -- --my-app golden-horizon --port 4173
```

## Documentation Map

- [Setup](./setup.md): prerequisites and `registered-apps.json` preparation
- [collect-reviews](./collect-reviews.md): main competitor review collection flow
- [collect-reviews-by-name](./collect-reviews-by-name.md): name-based id resolution and collection flow
- [translate-reviews](./translate-reviews.md): Korean translation pipeline for collected reviews
- [analyze-competitors](./analyze-competitors.md): Korean competitor insight report generation
- [render-report-html](./render-report-html.md): interactive web view (Raw + actionable backlog)
- [preview-report](./preview-report.md): local localhost preview server for rendered reports
