# AGENTS Guide

## Purpose

This repository has two user-facing CLI features. Keep implementation and docs synchronized at all times.

## Current Implementation Blueprint

### Feature 1: `review:collect`

- Entry file: `src/cli.ts`
- Build output: `dist/cli.js`
- NPM scripts: `review:collect`
- Main behavior:
- Resolves owner app from `registered-apps.json`
- Collects competitor reviews from explicit ids, `apps.json`, or auto-discovery
- Supports platform filtering (`both|ios|android`)
- Supports global market sweep (`--global` default on, `--no-global` to disable)
- Supports `--dry-run`, `--validate-only`, and JSON output mode
- Output path pattern: `data/{myAppId}/reviews/{competitor}.json`

### Feature 2: `review:collect-by-name`

- Entry file: `src/addByName.ts`
- Build output: `dist/addByName.js`
- NPM scripts: `review:collect-by-name`
- Main behavior:
- Resolves store ids by app name search
- Optional id overrides: `--play-id`, `--ios-id`
- Uses same platform/global logic to collect reviews
- Saves under owner app scope in `data/{myAppId}/reviews/`

### Shared Modules

- `src/registeredApps.ts`: owner app resolution
- `src/competitorDiscovery.ts`: auto-discovery logic
- `src/storeLocale.ts`: market/country lists
- `src/playReviews.ts`, `src/appStoreReviews.ts`: source collectors
- `src/appMetadata.ts`: display name enrichment
- `src/utils.ts`: output path, dedupe, IO, fetch retry

## Documentation Structure

- English root: `docs/en-US/README.md`
- Korean root: `docs/ko-KR/README.md`
- Setup docs are merged into locale README files.
- Review docs: `docs/en-US/01-review.md`, `docs/ko-KR/01-review.md`
- Report docs: `docs/en-US/02-report.md`, `docs/ko-KR/02-report.md`

## Mandatory Doc Sync Rules

1. If code behavior changes, update relevant docs in both English and Korean in the same change.
2. If CLI options/flags/defaults/output schema change, update:
- `docs/en-US/01-review.md` and `docs/ko-KR/01-review.md` for `review:*`
- `docs/en-US/02-report.md` and `docs/ko-KR/02-report.md` for `report:*`
- both locale README doc maps when links/titles change
3. If a new script/feature is added, create both docs files immediately:
- add a new section in the matching English/Korean command document (`01-review.md` or `02-report.md`)
4. Keep command docs separated by command family:
- `review:*` in `01-review.md`
- `report:*` in `02-report.md`
5. If command names are renamed, update all of:
- `package.json` scripts
- yargs `.scriptName(...)`
- command examples in root `README.md` and locale docs
6. Before finishing, run:
- `npm run build`
7. If you modify HTML generation logic in `src/renderReportHtml.ts`, regenerate all report HTML files before finishing:
- `npm run report:render-html -- --all`

## Change Checklist

- [ ] Implementation updated
- [ ] English docs updated
- [ ] Korean docs updated
- [ ] README links/examples updated
- [ ] Build passes
- [ ] If `src/renderReportHtml.ts` changed, ran `npm run report:render-html -- --all`
