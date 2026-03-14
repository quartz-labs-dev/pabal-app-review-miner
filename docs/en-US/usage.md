# Usage

For prerequisites and registered app setup, see [Setup](./setup.md).

## CLI Options

- `--my-app` (required): key to resolve your app id
- `--play`: competitor Google Play app id
- `--ios`: competitor App Store app id
- `--auto-top`: top N competitors per available store for auto-discovery mode (default `5`)
- `--limit`: number of reviews per store (default `200`)
- `--global`: collect reviews by iterating store-specific global market lists (Play country+language, App Store country). In global mode, `--limit` applies per market.
- `--apps`: path to competitor list JSON
- `--registered-apps-path`: custom registered apps file path
- `--output text|json`: output mode (default `text`)
- `--dry-run`: plan actions without fetch/write
- `--validate-only`: validate mappings only (no fetch/write)

## Single Competitor

```bash
node dist/cli.js photopills \
  --my-app golden-horizon \
  --play com.photopills.photopills \
  --ios 596027698 \
  --limit 200
```

## Multi Competitor

```bash
node dist/cli.js --my-app golden-horizon --apps apps.json --limit 200
```

## Auto Discovery (`--my-app` only)

```bash
node dist/cli.js --my-app golden-horizon --auto-top 5 --limit 200
```

Global market sweep:

```bash
node dist/cli.js --my-app golden-horizon --auto-top 5 --limit 200 --global
```

- If no `--apps`, `--play`, `--ios`, or positional `appName` is provided, the CLI auto-discovers competitors.
- Discovery is per available owner store id in `registered-apps.json`:
  - Google Play: `googlePlay.packageName`
  - App Store: `appStore.appId` (`You Might Also Like` shelf first, then search fallback)

## Output

- `data/{myAppId}/reviews/{competitor}.json`

## Agent-Friendly Modes

Machine-readable JSON report:

```bash
node dist/cli.js --my-app golden-horizon --apps apps.json --output json
```

Dry-run (no network, no file writes):

```bash
node dist/cli.js --my-app golden-horizon --apps apps.json --dry-run --output json
```

Validate-only (input/target validation only):

```bash
node dist/cli.js --my-app golden-horizon --apps apps.json --validate-only --output json
```
