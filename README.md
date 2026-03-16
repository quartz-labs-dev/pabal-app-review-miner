# pabal-app-review-miner

CLI tool for collecting raw competitor reviews from Google Play and App Store, organized by your app id.

## What It Does

- Collects newest reviews from Google Play and App Store
- Supports single-app and multi-app competitor input
- Auto-discovers top competitors when only `--my-app` is provided
- Saves raw JSON per competitor under your app scope
- Adds stable `reviewId` (and optional `storeReviewId`) per review item for dedupe/linking
- Translates collected reviews into Korean
- Generates competitor analysis reports from translated reviews

Output structure:

- `data/{myAppId}/reviews/{competitor}.json`

## Quick Start

```bash
npm install
npm run build
npm run setup:icon
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200 --append-existing

# or auto-discover competitors (top 5 per available store by default)
npm run review:collect -- --my-app golden-horizon --auto-top 5 --limit 200

# platform filter (default: both, optional: ios | android)
npm run review:collect -- --my-app golden-horizon --apps apps.json --platform ios --limit 200

# add one app by name (searches both stores, then collects and saves reviews)
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy"

# backfill missing reviewId in existing saved JSON (no re-download)
npm run review:backfill-ids -- --my-app golden-horizon

# translate all collected reviews to Korean (output: data/{myAppId}/reviews-ko)
npm run report:translate -- --my-app golden-horizon

# generate Korean competitor report (output: data/{myAppId}/reports)
npm run report:analyze -- --my-app golden-horizon

# render interactive HTML (Raw + Backlog tabs, Korean default with source toggle)
npm run report:render-html -- --my-app golden-horizon

# preview the rendered HTML on localhost
npm run report:preview -- --my-app golden-horizon --port 4173

# or start dashboard home (all apps) and click each generated report file
npm run report:preview -- --port 4173
```

`setup:icon` skips manual bootstrap when `pabal-store-api-mcp` is already configured.
If `~/.config/pabal-mcp/config.json` includes `dataDir` and pabal-web exists, it also syncs product icons (`public/products/*/icons/icon.png`, with `public/products/*/icon.png` as fallback) to `data/{appId}/icon.png` for dashboard and report screens.

## Documentation

- English: [docs/en-US/README.md](docs/en-US/README.md)
- 한국어: [docs/ko-KR/README.md](docs/ko-KR/README.md)

## Development

```bash
npm run dev -- --port 4173
```

## License

MIT
