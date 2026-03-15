# Usage: `report:preview`

For prerequisites and owner app resolution, see [Setup](../setup.md).

This script runs a localhost preview server.

- Dashboard mode (default): home page lists apps and generated report files (`.html`, `.md`, `.json`)
- Single-file mode (`--file`): serves one HTML report at `/`

- `npm run report:preview -- [options]`
- `node dist/previewReport.js ...`

## Prerequisite

Generate the HTML report first:

```bash
npm run report:render-html -- --my-app aurora-eos
```

## CLI Options

- `--my-app` (optional): owner app key to filter dashboard app list
- `--registered-apps-path`: custom registered apps file path
- `--file`: single-file mode html path to serve at `/`
- `--data-dir`: dashboard data root (default: `data/`)
- `--host`: bind host (default: `127.0.0.1`)
- `--port`: bind port (default: `4173`)

## Dashboard Run (All Apps)

```bash
npm run report:preview -- --port 4173
```

Then open:

- `http://127.0.0.1:4173/`

## Dashboard Run (Filtered by One App)

```bash
npm run report:preview -- --my-app aurora-eos --port 4173
```

## Single-File Run

```bash
npm run report:preview -- \
  --file data/aurora-eos/reports/competitor-raw-actionable.ko.html \
  --port 4173
```
