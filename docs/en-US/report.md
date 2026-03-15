# Report Commands (en-US)

For prerequisites and registered app setup, see [README](./README.md).

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
- Generated HTML top bar includes a `Home` button (`/`) at the top-left.
- In top controls, `Show all original text` appears only in `Raw Reviews` tab, and `Expand evidence` appears only in `Actionable Backlog` tab.

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
