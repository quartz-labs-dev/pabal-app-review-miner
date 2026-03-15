# pabal-app-review-miner

CLI tool for collecting raw competitor reviews from Google Play and App Store, organized by your app id.

## What It Does

- Collects newest reviews from Google Play and App Store
- Supports single-app and multi-app competitor input
- Auto-discovers top competitors when only `--my-app` is provided
- Saves raw JSON per competitor under your app scope
- Translates collected reviews into Korean
- Generates competitor analysis reports from translated reviews

Output structure:

- `data/{myAppId}/reviews/{competitor}.json`

## Quick Start

```bash
npm install
npm run build
npm run setup:config
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --limit 200

# or auto-discover competitors (top 5 per available store by default)
npm run collect-reviews -- --my-app golden-horizon --auto-top 5 --limit 200

# platform filter (default: both, optional: ios | android)
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --platform ios --limit 200

# add one app by name (searches both stores, then collects and saves reviews)
npm run collect-reviews-by-name -- --my-app golden-horizon --name "BJJBuddy"

# translate all collected reviews to Korean (output: data/{myAppId}/reviews-ko)
npm run translate-reviews -- --my-app golden-horizon

# generate Korean competitor report (output: data/{myAppId}/reports)
npm run analyze-competitors -- --my-app golden-horizon

# render interactive HTML (Raw + Backlog tabs, Korean default with source toggle)
npm run render-report-html -- --my-app golden-horizon

# preview the rendered HTML on localhost
npm run preview-report -- --my-app golden-horizon --port 4173
```

## Documentation

- English: [docs/en-US/README.md](docs/en-US/README.md)
- 한국어: [docs/ko-KR/README.md](docs/ko-KR/README.md)

## Development

```bash
npm run dev:collect-reviews -- --my-app golden-horizon --apps apps.json --limit 200
```

## License

MIT
