# Reports Guide (en-US)

For prerequisites and registered app setup, see [Setup](./setup.md).

This single guide documents all review/report scripts.

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
- `--limit`: number of reviews per source request (default `200`)
- `--global`: collect across global market lists (default enabled)
- `--no-global`: disable global sweep (`us/en` Play, `us` App Store only)
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
npm run review:collect -- --my-app golden-horizon --apps apps.json --output json
```

### Output

- `data/{myAppId}/reviews/{competitor}.json`

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
- `--limit`: reviews per source request (default `200`)
- `--global` / `--no-global`: global market sweep toggle
- `--registered-apps-path`: custom path
- `--output text|json`: output mode

### Examples

```bash
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --limit 200
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --platform ios
npm run review:collect-by-name -- --my-app golden-horizon --name "BJJBuddy" --output json
```

### Output

- `data/{myAppId}/reviews/manual__play-<id>__ios-<id>.json` (depends on resolved ids)

## `report:translate`

Translate collected review JSON files to Korean.

- `npm run report:translate -- --my-app <owner> ...`
- `node dist/translateReviews.js ...`

### CLI Options

- `--my-app` (required)
- `--registered-apps-path`
- `--input-dir` (default: `data/{myAppId}/reviews`)
- `--output-dir` (default: `data/{myAppId}/reviews-ko`)
- `--target-lang` (default: `ko`)
- `--provider` (`google-web` | `none`, default `google-web`)
- `--overwrite` (default `false`)
- `--concurrency` (default `4`)
- `--output text|json`

### Example

```bash
npm run report:translate -- --my-app golden-horizon
```

### Output

- `data/{myAppId}/reviews-ko/{competitor}.json`
- `data/{myAppId}/reviews-ko/.translation-cache.json`

## `report:analyze`

Generate competitor insight report from translated reviews.

- `npm run report:analyze -- --my-app <owner> ...`
- `node dist/analyzeCompetitors.js ...`

### CLI Options

- `--my-app` (required)
- `--registered-apps-path`
- `--input-dir` (default: `data/{myAppId}/reviews-ko`, fallback `reviews/`)
- `--output-dir` (default: `data/{myAppId}/reports`)
- `--include-self` (default `false`)
- `--top-quotes` (default `3`)
- `--output text|json`

### Examples

```bash
npm run report:analyze -- --my-app golden-horizon
npm run report:analyze -- --my-app golden-horizon --include-self
```

### Output

- `data/{myAppId}/reports/competitor-report.ko.md`
- `data/{myAppId}/reports/competitor-report.ko.json`

## `report:render-html`

Render actionable markdown report to interactive HTML.

- `npm run report:render-html -- --my-app <owner> ...`
- `node dist/renderReportHtml.js ...`

### CLI Options

- `--my-app` (required)
- `--registered-apps-path`
- `--input` (default: `data/{myAppId}/reports/competitor-raw-actionable.ko.md`)
- `--output` (default: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`)

### Example

```bash
npm run report:render-html -- --my-app aurora-eos
```

### Output

- `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## `report:preview`

Run localhost preview server.

- Dashboard mode: home lists app ids and generated report files (`.html`, `.md`, `.json`)
- Single-file mode: serve one HTML file with `--file`

- `npm run report:preview -- [options]`
- `node dist/previewReport.js ...`

### CLI Options

- `--my-app` (optional): dashboard filter
- `--registered-apps-path`
- `--file`: single-file mode path
- `--data-dir` (default: `data/`)
- `--host` (default: `127.0.0.1`)
- `--port` (default: `4173`)

### Examples

```bash
npm run report:preview -- --port 4173
npm run report:preview -- --my-app aurora-eos --port 4173
npm run report:preview -- --file data/aurora-eos/reports/competitor-raw-actionable.ko.html --port 4173
```
