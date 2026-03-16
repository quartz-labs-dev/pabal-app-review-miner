# pabal-app-review-miner

CLI for collecting competitor reviews from Google Play/App Store and generating reports.

## Quick Start

Use this repository by cloning it:

```bash
git clone https://github.com/quartz-labs-dev/pabal-app-review-miner.git
cd pabal-app-review-miner
npm install
npm run build
npm run setup:icon
```

Collect reviews and generate a report:

```bash
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200
npm run report:translate -- --my-app golden-horizon
npm run report:analyze -- --my-app golden-horizon
npm run report:render-html -- --my-app golden-horizon
```

## Documentation

- English: [docs/en-US/README.md](docs/en-US/README.md)
- 한국어: [docs/ko-KR/README.md](docs/ko-KR/README.md)

## Development

```bash
npm run dev -- --port 4173
```

## License

MIT
