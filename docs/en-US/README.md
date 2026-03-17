# pabal-app-review-miner Docs

## Setup

1. Clone and enter this repository.

```bash
git clone https://github.com/quartz-labs-dev/pabal-app-review-miner.git
cd pabal-app-review-miner
```

2. Install dependencies and build.

```bash
npm install
npm run build
```

3. Prepare `registered-apps.json` with `pabal-store-api-mcp`.

Set up `pabal-store-api-mcp` first by following:
- [pabal-store-api-mcp README](https://pabal.quartz.best/docs/pabal-store-api-mcp/README)

Then run icon setup in this repository:

```bash
npm run setup:icon
```

<details>
<summary>Manual setup (if you do not use pabal-store-api-mcp)</summary>

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
        "appId": "1234567890"
      },
      "googlePlay": {
        "packageName": "com.quartz.goldenhorizon"
      }
    }
  ]
}
JSON
chmod 600 ~/.config/pabal-mcp/registered-apps.json
npm run setup:icon
```

</details>

<details>
<summary>Optional: notes and quick validation</summary>

`--my-app` is resolved from `~/.config/pabal-mcp/registered-apps.json`.

```bash
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 1
```

</details>

## Documentation Map

- [Review Commands](./01-review.md): Collect competitor app reviews from App Store/Google Play and save raw JSON data.
- [Report Commands](./02-report.md): Use collected reviews to translate data, render shared-viewer bundles, and manage backlog/preview state.
