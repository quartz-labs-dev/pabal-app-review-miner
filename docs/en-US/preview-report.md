# Usage: `preview-report`

For prerequisites and owner app resolution, see [Setup](./setup.md).

This script serves the rendered HTML report on localhost so you can inspect it in a browser:

- `npm run preview-report -- --my-app <owner> ...`
- `node dist/previewReport.js ...`

## Prerequisite

Generate the HTML report first:

```bash
npm run render-report-html -- --my-app aurora-eos
```

## CLI Options

- `--my-app` (required): owner app key (`slug`, `name`, `bundleId`, `packageName`, or `appId`)
- `--registered-apps-path`: custom registered apps file path
- `--file`: html file path to serve
  - default: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`
- `--host`: bind host (default: `127.0.0.1`)
- `--port`: bind port (default: `4173`)

## Basic Run

```bash
npm run preview-report -- --my-app aurora-eos --port 4173
```

Then open:

- `http://127.0.0.1:4173/`
