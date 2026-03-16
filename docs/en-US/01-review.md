# Review Commands

## `review:collect`

Main collector script for competitor review data.

- `npm run review:collect -- --my-app <owner> ...`
- `node dist/cli.js ...`

### CLI Options

- `--my-app` (required): key to resolve your app id
- `--play`: competitor Google Play app id
- `--ios`: competitor App Store app id
- `--platform`: `both` | `ios` | `android` (default `both`)
- `--auto-top`: top N competitors per store in auto-discovery (default `5`)
- `--limit`: number of reviews per source request (default `200`, not a hard cap)
- `--global`: collect across global market lists (default enabled)
- `--no-global`: disable global sweep (`us/en` Play, `us` App Store only)
- `--append-existing`: merge with existing output JSON and dedupe by `reviewId` (default `false`)
- `--apps`: competitor list JSON path
- `--registered-apps-path`: custom registered apps path
- `--output text|json`: output mode (default `text`)
- `--dry-run`: planning only
- `--validate-only`: validation only

### Examples

```bash
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200
npm run review:collect -- --my-app golden-horizon --auto-top 5 --limit 200
npm run review:collect -- --my-app golden-horizon --apps apps.json --platform ios --limit 200
npm run review:collect -- --my-app golden-horizon --apps apps.json --limit 200 --append-existing
npm run review:collect -- --my-app golden-horizon --apps apps.json --output json
```

### Output

- `data/{myAppId}/reviews/{competitor}.json`
- Each `reviews[]` item includes:
  - `reviewId`: stable id used for dedupe and preview state linkage
  - `storeReviewId` (optional): store-provided raw id when available

## `review:collect-by-name`

Name-based id resolution and review collection.

- `npm run review:collect-by-name -- --my-app <owner> --name "<query>" ...`
- `node dist/addByName.js ...`

### CLI Options

- `--my-app` (required): owner app key
- `--name` (required): app name query
- `--play-id`: optional Play id override
- `--ios-id`: optional App Store id override
- `--platform`: `both` | `ios` | `android` (default `both`)
- `--limit`: reviews per source request (default `200`, not a hard cap)
- `--global` / `--no-global`: global market sweep toggle
- `--append-existing`: merge with existing output JSON and dedupe by `reviewId` (default `false`)
- `--registered-apps-path`: custom path
- `--output text|json`: output mode

### Examples

```bash
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --limit 200
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --platform ios
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --append-existing
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --output json
```

### Output

- `data/{myAppId}/reviews/manual__play-<id>__ios-<id>.json` (depends on resolved ids)

## `review:backfill-ids`

Backfill missing `reviewId` values in already-saved review JSON files without re-downloading.

- `npm run review:backfill-ids -- --my-app <owner> ...`
- `node dist/backfillReviewIds.js ...`

### CLI Options

- `--my-app` (required): owner app key
- `--registered-apps-path`: custom path
- `--input-dir` (default: `data/{myAppId}/reviews`)
- `--dry-run`: scan only, do not write files
- `--output text|json`: output mode

### Examples

```bash
npm run review:backfill-ids -- --my-app golden-horizon
npm run review:backfill-ids -- --my-app golden-horizon --dry-run
npm run review:backfill-ids -- --my-app golden-horizon --input-dir data/golden-horizon/reviews-ko
```
