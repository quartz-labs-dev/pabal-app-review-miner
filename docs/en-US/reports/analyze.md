# Usage: `report:analyze`

For prerequisites and owner app resolution, see [Setup](../setup.md).

This guide documents the competitor insight report generator:

- `npm run report:analyze -- --my-app <owner> ...`
- `node dist/analyzeCompetitors.js ...`

## CLI Options

- `--my-app` (required): owner app key (`slug`, `name`, `bundleId`, `packageName`, or `appId`)
- `--registered-apps-path`: custom registered apps file path
- `--input-dir`: review input directory (default: `data/{myAppId}/reviews-ko`, fallback to `reviews/` if missing)
- `--output-dir`: output report directory (default: `data/{myAppId}/reports`)
- `--include-self`: include `*-self.json` in analysis (default: `false`)
- `--top-quotes`: representative low-rating quotes per competitor (default: `3`)
- `--output text|json`: output mode (default: `text`)

## Basic Run

```bash
npm run report:analyze -- --my-app golden-horizon
```

## Include Self App Benchmark

```bash
npm run report:analyze -- --my-app golden-horizon --include-self
```

## JSON Output

```bash
npm run report:analyze -- --my-app golden-horizon --output json
```

## Output

- `data/{myAppId}/reports/competitor-report.ko.md`
- `data/{myAppId}/reports/competitor-report.ko.json`

The report includes:

- competitor-level rating and low-rating ratios
- recent 90-day low-rating trend
- keyword-based topic summaries (negative and positive)
- representative low-rating review quotes
