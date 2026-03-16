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
- Generated markdown title (H1) now follows `{myAppId} 리뷰 리포트`.

## `report:render-html`

Render actionable markdown report to interactive HTML.

- `npm run report:render-html -- --my-app <owner> ...`
- `node dist/renderReportHtml.js ...`
- HTML document title (`<title>` and H1) is fixed to `{myAppId} 리뷰 리포트` (or `{myAppId} Review Report` for English reports).
- Generated HTML top bar includes a `Home` button (`/`) at the top-left.
- Filters are managed in a separate panel opened from the top bar `Filter` button.
- On narrow screens, the filter panel opens as a bottom sheet.
- On narrow screens, the notes panel also opens as a bottom sheet instead of a right drawer.
- Search is shown as a `🔎` button by default and expands to the input field on tap/click.
- Top controls are tab-scoped: `Reviews` shows `Filter` and `Notes`, while `Reports` shows `Expand evidence`, `Priority` filter, and the same `Notes` button/sidebar.
- In `Reports`, the secondary status row is hidden so the navigation area stays single-row (the `Reports N/N` count label is not shown).
- `Reports` shows one unified backlog table across all apps (not per-app grouped sections).
- In `Reports`, identical backlog items are merged into a single row even when they come from different apps.
- The app list in each backlog row is rendered as a single-line text with ellipsis (`...`) when it overflows.
- In `Reports`, you can filter rows by priority (`All / MUST / SHOULD / COULD`).
- In the `Reports` table, there is no separate `Evidence` column; use the chevron button next to `Evidence count` to expand/collapse evidence rows.
- In `Reviews`, hashtag filter supports multi-select (`#❤️`, `#Satisfaction`, `#Dissatisfaction`), and `All tags` clears tag filters.
- In `Reviews`, state filter is tri-state: `All` / `Active` / `Inactive` (default: `All`).
- In `Reviews`, you can toggle `100+ chars` to focus on longer reviews.
- `Reset filters` clears search/state/tag/length filters in one click.
- In the filter panel, `Reset all to inactive` sets every review to `Inactive` in bulk and clears all hashtags.
- `Reviews` tab supports pagination with a fixed page size of `100 items/page`.
- Pagination is applied to the current search/filter result set, and `total reviews` is shown in the pagination area.
- The context block below the title switches by tab, so each tab shows only relevant context.
- In the `Reports` tab context, a compact text summary is shown (backlog counts, generated time, and priority rule) without stat/meta cards.
- In the `Reviews` tab context block, the `Raw quotes` card and generated-at/criteria/classification meta list are not shown.
- Review cards include `#❤️ / #Satisfaction / #Dissatisfaction` hashtag toggles and `Inactive/Active`.
- In review cards, `Original` text open/close uses a smooth expand/collapse animation.
- Hashtags can be edited only when the card is `Active`.
- Top-right controls include a `Notes` button; in the right sidebar you can switch the app selector to manage app-level notes.
- In the notes panel, use the app selector to switch the currently active app for note editing.
- The notes sidebar shows the selected app name and store links (App Store / Google Play).
- Notes are not auto-saved; use `Save` (or `Ctrl/Cmd + S`) to persist note changes.
- Reviews view is hydrated from full review datasets (`data/{myAppId}/reviews-ko/*.json`, fallback `reviews/*.json`) per app:
  - preselected report quotes start as `Active`
  - non-selected reviews are included as `Inactive` by default for manual curation
- In preview mode, card states and app notes are persisted to `data/{myAppId}/reports/preview-state.json` (card state updates immediately; notes persist on explicit save).
- `preview-state.json` now uses v2 schema only (`reviews.tags`, `reviews.excluded`, `appNotes`). Older `favorite`/`notes` fields are no longer used.
- If `data/{myAppId}/icon.png` exists, HTML includes icon meta tags (`icon`, `og:image`, `twitter:image`) automatically.

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
- Dashboard mode can display app icons when `data/{appId}/icon.png` exists
- Report page header also uses `data/{appId}/icon.png`; when missing, UI falls back to `appId` text
- Dashboard background fills the full viewport height (no abrupt cut when content is short).
- Single-file mode: serve one HTML file with `--file`
- Serves preview state API for raw-review card management:
  - `GET /api/preview-state/:appId`
  - `PUT /api/preview-state/:appId`
  - persistence file: `data/{myAppId}/reports/preview-state.json`

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
