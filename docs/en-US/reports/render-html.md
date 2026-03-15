# Usage: `report:render-html`

For prerequisites and owner app resolution, see [Setup](../setup.md).

This script renders the actionable raw markdown report into an interactive HTML page:

- `npm run report:render-html -- --my-app <owner> ...`
- `node dist/renderReportHtml.js ...`

## CLI Options

- `--my-app` (required): owner app key (`slug`, `name`, `bundleId`, `packageName`, or `appId`)
- `--registered-apps-path`: custom registered apps file path
- `--input`: input markdown report path
  - default: `data/{myAppId}/reports/competitor-raw-actionable.ko.md`
- `--output`: output html path
  - default: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## Basic Run

```bash
npm run report:render-html -- --my-app aurora-eos
```

## Output

- `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## Viewer Features

- Default Korean-first display
- Toggle source/original text globally or per quote
- `Raw 리뷰` tab: full categorized bilingual evidence
- `실행 백로그` tab: one-glance backlog (`must/should/could`, impact, effort, evidence)
- Search across Korean text, source text, app names, and backlog items
