# pabal-app-review-miner

CLI tool for collecting raw competitor reviews from Google Play and App Store, organized by your app id.

## What It Does

- Collects newest reviews from Google Play and App Store
- Supports single-app and multi-app competitor input
- Auto-discovers top competitors when only `--my-app` is provided
- Saves raw JSON per competitor under your app scope

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
