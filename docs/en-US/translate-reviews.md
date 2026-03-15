# Usage: `translate-reviews`

For prerequisites and owner app resolution, see [Setup](./setup.md).

This guide documents the Korean translation script for collected review files:

- `npm run translate-reviews -- --my-app <owner> ...`
- `node dist/translateReviews.js ...`

## CLI Options

- `--my-app` (required): owner app key (`slug`, `name`, `bundleId`, `packageName`, or `appId`)
- `--registered-apps-path`: custom registered apps file path
- `--input-dir`: input directory with raw review JSON files (default: `data/{myAppId}/reviews`)
- `--output-dir`: output directory for translated review JSON files (default: `data/{myAppId}/reviews-ko`)
- `--target-lang`: translation target language (default: `ko`)
- `--provider`: translation provider `google-web` | `none` (default: `google-web`)
- `--overwrite`: overwrite existing translated files (default: `false`)
- `--concurrency`: translation worker count (default: `4`)
- `--output text|json`: output mode (default: `text`)

## Basic Run

```bash
npm run translate-reviews -- --my-app golden-horizon
```

## Re-translate Existing Files

```bash
npm run translate-reviews -- --my-app golden-horizon --overwrite
```

## JSON Output

```bash
npm run translate-reviews -- --my-app golden-horizon --output json
```

## Output

- `data/{myAppId}/reviews-ko/{competitor}.json`
- `data/{myAppId}/reviews-ko/.translation-cache.json` (text-level translation cache for reuse)

Each translated review keeps original `text` and adds:

- `textKo`: translated Korean text
- `detectedLang`: detected source language when available
- `translatedAt`: translation timestamp
