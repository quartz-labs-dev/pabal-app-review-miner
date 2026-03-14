# pabal-app-review-miner

CLI tool for collecting raw competitor reviews from Google Play and App Store, organized by your app id.

## What It Does

- Collects newest reviews from Google Play and App Store
- Supports single-app and multi-app competitor input
- Saves raw JSON per competitor under your app scope

Output structure:

- `data/{myAppId}/reviews/{competitor}.json`

## Quick Start

```bash
npm install
npm run build
npm run setup:config
node dist/cli.js --my-app golden-horizon --apps apps.json --limit 200
```

## Documentation

- English: [docs/en-US/README.md](docs/en-US/README.md)
- 한국어: [docs/ko-KR/README.md](docs/ko-KR/README.md)

## Development

```bash
npm run dev -- --my-app golden-horizon --apps apps.json --limit 200
```

## License

MIT
