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
- Setup docs: `docs/en-US/setup.md`, `docs/ko-KR/setup.md`
- Unified command docs:
- `docs/en-US/reports.md`
- `docs/ko-KR/reports.md`

## Mandatory Doc Sync Rules

1. If code behavior changes, update relevant docs in both English and Korean in the same change.
2. If CLI options/flags/defaults/output schema change, update:
- `docs/en-US/reports.md` and `docs/ko-KR/reports.md`
- both locale README doc maps when links/titles change
3. If a new script/feature is added, create both docs files immediately:
- add a new section in `docs/en-US/reports.md`
- add a matching section in `docs/ko-KR/reports.md`
4. Keep command docs consolidated in `reports.md` with clear per-script sections.
5. If command names are renamed, update all of:
- `package.json` scripts
- yargs `.scriptName(...)`
- command examples in root `README.md` and locale docs
6. Before finishing, run:
- `npm run build`

## Change Checklist

- [ ] Implementation updated
- [ ] English docs updated
- [ ] Korean docs updated
- [ ] README links/examples updated
- [ ] Build passes
