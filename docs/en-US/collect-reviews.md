# Usage: `collect-reviews`

For prerequisites and registered app setup, see [Setup](./setup.md).

This guide documents the main collector script:

- `npm run collect-reviews -- --my-app <owner> ...`
- `node dist/cli.js ...`

## CLI Options

- `--my-app` (required): key to resolve your app id
- `--play`: competitor Google Play app id
- `--ios`: competitor App Store app id
- `--platform`: review source filter: `both` | `ios` | `android` (default `both`)
- `--auto-top`: top N competitors per available store for auto-discovery mode (default `5`)
- `--limit`: number of reviews per source request (default `200`)
- `--global`: collect reviews by iterating store-specific global market lists (Play country+language, App Store country). Default is enabled. In global mode, `--limit` applies per market.
- `--no-global`: disable global market sweep and use only default market requests (`us/en` for Play, `us` for App Store)
- `--apps`: path to competitor list JSON
- `--registered-apps-path`: custom registered apps file path
- `--output text|json`: output mode (default `text`)
- `--dry-run`: plan actions without fetch/write
- `--validate-only`: validate mappings only (no fetch/write)

## Single Competitor

```bash
npm run collect-reviews -- photopills \
  --my-app golden-horizon \
  --play com.photopills.photopills \
  --ios 596027698 \
  --limit 200
```

iOS only:

```bash
npm run collect-reviews -- photopills \
  --my-app golden-horizon \
  --play com.photopills.photopills \
  --ios 596027698 \
  --platform ios \
  --limit 200
```

Android only:

```bash
npm run collect-reviews -- photopills \
  --my-app golden-horizon \
  --play com.photopills.photopills \
  --ios 596027698 \
  --platform android \
  --limit 200
```

## Multi Competitor (`apps.json`)

```bash
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --limit 200
```

## Auto Discovery (`--my-app` only)

```bash
npm run collect-reviews -- --my-app golden-horizon --auto-top 5 --limit 200
```

Global sweep explicitly enabled:

```bash
npm run collect-reviews -- --my-app golden-horizon --auto-top 5 --limit 200 --global
```

Global sweep disabled:

```bash
npm run collect-reviews -- --my-app golden-horizon --auto-top 5 --limit 200 --no-global
```

- If no `--apps`, `--play`, `--ios`, or positional `appName` is provided, the CLI auto-discovers competitors.
- Discovery runs per available owner store id in `registered-apps.json`:
- Google Play uses `googlePlay.packageName`
- App Store uses `appStore.appId` (`You Might Also Like` first, search fallback)
- Auto mode first fetches a candidate pool (up to `auto-top * 5`, capped at `50` per store), then keeps top `--auto-top` successful competitors per store.
- In auto-discovery run mode, competitors with total collected reviews `<= 20` are skipped and replaced by next candidates in the same store pool.

## Output

- `data/{myAppId}/reviews/{competitor}.json`

## Agent-Friendly Modes

Machine-readable JSON report:

```bash
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --output json
```

Dry-run:

```bash
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --dry-run --output json
```

Validate-only:

```bash
npm run collect-reviews -- --my-app golden-horizon --apps apps.json --validate-only --output json
```
