# Report Commands

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

## `report:render-html`

Render actionable markdown report to a shared-viewer bundle JSON.

- `npm run report:render-html -- --my-app <owner> ...`
- `npm run report:render-html -- --all`
- `node dist/renderReportHtml.js ...`
- Default output is JSON bundle only. Legacy per-app HTML file is optional (`--with-html`).
- HTML document title (`<title>` and H1) is fixed to `{myAppId} 리뷰 리포트` (or `{myAppId} Review Report` for English reports).
- Generated HTML top bar includes a `Home` button (`/`) at the top-left.
- Filters are managed in a separate panel opened from the top bar `Filter` button.
- On narrow screens, the filter panel opens as a bottom sheet.
- On narrow screens, the notes panel also opens as a bottom sheet instead of a right drawer.
- Search is shown as a `🔎` button by default and expands to the input field on tap/click.
- Top controls are tab-scoped: `Reviews` and `Reports` both show `Filter` and `Notes`.
- In `Reports`, `Expand evidence` is available inside the filter panel.
- Top navigation state is synced to query parameters, so refresh keeps the same UI state:
  - `tab` (`reviews|reports`, aliases `review/raw`, `report/backlog`)
  - `q` (search text)
  - `tags` (multi-select tags, comma-separated)
  - `exclude` (`all|active|excluded`)
  - `min100` (`1` when `100+ chars` is enabled)
  - `orig` (`1` when `Original` toggle is enabled)
  - `priority` (`all|must|should|could` in `Reports`)
  - `effort` (`all|high|medium|low` in `Reports`)
- The status row under the header is shown in both tabs:
  - left: active filter chips (`No filter` when empty)
  - right: selected/filtered count over total (`Reviews x/y` or `Backlog x/y`)
- `Reports` shows one unified backlog table across all apps (not per-app grouped sections).
- In `Reports`, identical backlog items are merged into a single row even when they come from different apps.
- In `Reports`, near-duplicate backlog rows (same normalized title/action) are also merged during backlog normalization.
- The app list in each backlog row is rendered as a single-line text with ellipsis (`...`) when it overflows.
- In `Reports`, use the same filter panel UX as `Reviews` to filter rows by `Priority / Effort`.
- In the `Reports` table, there is no separate `Evidence` column; use the chevron button next to `Evidence count` to expand/collapse evidence rows.
- `Evidence count` is calculated as the number of unique reviews (`reviewId`-based dedupe), not raw quote line count.
- In expanded evidence rows, the Korean sentence is shown by default (without `KR:` prefix), and `See details` reveals the review ID, metadata, and original text.
- Expanded evidence rows render prioritized evidence reviews only (top 8 max per backlog row).
- Backlog themes are now derived dynamically from each app's review text (token-frequency heuristic), instead of using a fixed hardcoded theme list.
- Synthetic backlog input now filters out low-signal reviews (e.g., short generic praise without request/issue) and keeps actionable evidence first.
- Backlog `action` text is generated as a concrete checklist (up to 3 items) inferred from matched evidence patterns, not only a generic count sentence.
- Backlog `action` text no longer appends evidence-count suffixes like `(근거 리뷰 N건)` or `(evidence N reviews)`; use the `Evidence count` column instead.
- In `Reviews`, hashtag filter supports multi-select (`#❤️`, `#Requests`, `#Satisfaction`, `#Dissatisfaction`), and `All tags` clears tag filters.
- In `Reviews`, state filter is tri-state: `All` / `Active` / `Inactive` (default: `All`).
- In `Reviews`, you can toggle `100+ chars` to focus on longer reviews.
- `Reset filters` clears search/state/tag/length filters in one click.
- In the filter panel, `Reset all to inactive` sets every review to `Inactive` in bulk and clears all hashtags.
- The review filter sidebar/bottom sheet header shows `filtered reviews / total reviews` in real time.
- Each app row in the `Reviews` tab also shows `filtered reviews / total reviews` on the right.
- The context block below the title switches by tab, so each tab shows only relevant context.
- In the `Reports` tab context, a compact text summary is shown (backlog counts and hashtag-based priority rule) without stat/meta cards.
- In the `Reviews` tab context block, a plain text summary is shown (app count, hashtag definition, active-state definition) without cards.
- Review cards include `#❤️ / #Requests / #Satisfaction / #Dissatisfaction` hashtag toggles and `Inactive/Active`.
- Curated quotes are shown in one `Selected Reviews (Hashtag-based)` section instead of separate category sections.
- In review cards, `Original` text open/close uses a smooth expand/collapse animation.
- Hashtags can be edited only when the card is `Active`.
- Top-right controls include a `Notes` button; in the right sidebar you can switch the app selector to manage app-level notes.
- In the notes panel, use the app selector to switch the currently active app for note editing.
- The notes sidebar shows only store links (App Store / Google Play) for the selected app.
- Notes are not auto-saved; use `Save` (or `Ctrl/Cmd + S`) to persist note changes.
- In `Reports`, backlog rows are editable directly from the page:
  - add/remove backlog items
  - update each row's `Priority / Effort` directly from inline selectors
  - evidence review selection is done in a centered modal with pagination (active reviews only)
  - backlog editor body shows only currently selected evidence reviews (chip list)
  - in backlog editor, `Apply` saves immediately (persistent save)
  - report-table edits outside the backlog editor (row delete, inline priority/effort changes, `Backlog+` from Reviews) are also auto-persisted
- In `Reviews`, each review card has quick-add UX (`Backlog+`) to attach that review to an existing backlog item.
- When a review is added to backlog from `Reviews`, that review is automatically switched to `Active`.
- Reviews view is hydrated from full review datasets (`data/{myAppId}/reviews-ko/*.json`, fallback `reviews/*.json`) per app:
  - preselected report quotes start as `Active`
  - non-selected reviews are included as `Inactive` by default for manual curation
- In preview mode, card states and app notes are persisted to `data/{myAppId}/reports/preview-state.json` (card state updates immediately; notes persist on explicit save).
- `preview-state.json` is treated as a full-state snapshot for review cards (not diff-only overrides).
- `preview-state.json` now uses v2 schema only (`reviews.tags`, `reviews.excluded`, `appNotes`). Older `favorite`/`notes` fields are no longer used.
- If `data/{myAppId}/icon.png` exists, HTML includes icon meta tags (`icon`, `og:image`, `twitter:image`) automatically.

### CLI Options

- `--my-app` (required unless `--all` is set)
- `--all` (default `false`): batch render all apps that have review JSON (`data/{appId}/reviews-ko/*.json` or fallback `reviews/*.json`)
- `--registered-apps-path`
- `--input` (optional): source file (`.md` or `.json`). If omitted, source apps are derived from raw review JSON.
- `--output` (default: `data/{myAppId}/reports/competitor-raw-actionable.ko.json`)
- `--with-html` (default `false`): also write legacy HTML file
- `--html-output` (used with `--with-html`, default: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`)
- `--all` cannot be combined with `--my-app`, `--input`, `--output`, or `--html-output`

### Example

```bash
npm run report:render-html -- --my-app aurora-eos
npm run report:render-html -- --all
```

### Output

- `data/{myAppId}/reports/competitor-raw-actionable.ko.json` (shared-viewer bundle payload)
- `data/{myAppId}/reports/backlog.ko.json` (unified backlog `items` data; evidence is stored as scoped IDs in `sourceToken::reviewId` format)
- Optional legacy output with `--with-html`: `data/{myAppId}/reports/competitor-raw-actionable.ko.html`

## `report:init-backlog`

Initialize `backlog.ko.json` per app (separate from preview-state initialization).

- `npm run report:init-backlog -- --my-app <owner> ...`
- `npm run report:init-backlog -- --all`
- `node dist/initReportBacklog.js ...`
- Keeps existing backlog by default and only initializes missing backlog files.
- Uses `report:render-html` internally to create or normalize backlog data.

### CLI Options

- `--my-app` (required unless `--all` is set)
- `--all` (default `false`): initialize all renderable apps under `data/`
- `--registered-apps-path`
- `--data-dir` (default: `data/`)
- `--input` (single-app only): optional report source (`.md` / `.json`) passed to `report:render-html`
- `--force` (default `false`): regenerate backlog even if `backlog.ko.json` already exists
- `--dry-run` (default `false`)
- `--all` cannot be combined with `--my-app` or `--input`

### Example

```bash
npm run report:init-backlog -- --my-app aurora-eos
npm run report:init-backlog -- --my-app aurora-eos --force
npm run report:init-backlog -- --all
```

### Output

- `data/{myAppId}/reports/backlog.ko.json`

## `report:init-state`

Initialize `preview-state.json` from report bundle defaults.

- `npm run report:init-state -- --my-app <owner> ...`
- `npm run report:init-state -- --all`
- `node dist/initReportState.js ...`
- Seeds all review states into `data/{myAppId}/reports/preview-state.json` using:
  - `reviewDefaults[reviewId].excluded` (Active/Inactive default)
  - `reviewDefaults[reviewId].tags` (default hashtags)
- This command is intended for initial migration/reset. After initialization, manage card states in preview UI.
- `report:render-html` writes report bundles (and optional legacy HTML) and does not reset `preview-state.json`.

### CLI Options

- `--my-app` (required unless `--all` is set)
- `--all` (default `false`): initialize all apps that have `data/{appId}/reports/competitor-raw-actionable.ko.json`
- `--registered-apps-path`
- `--data-dir` (default: `data/`)
- `--input` (default: `data/{myAppId}/reports/competitor-raw-actionable.ko.json`)
- `--output` (default: `data/{myAppId}/reports/preview-state.json`)
- `--keep-notes` (default `true`): keep existing app notes while re-initializing review states
- `--all` cannot be combined with `--my-app`, `--input`, or `--output`

### Example

```bash
npm run report:init-state -- --my-app aurora-eos
npm run report:init-state -- --all
```

### Output

- `data/{myAppId}/reports/preview-state.json`

## `report:preview`

Run localhost preview server.

- Dashboard mode: home lists app ids and generated report files (`.md`, `.json`, optional legacy `.html`)
- Recommended flow: keep per-app data as JSON bundles and open `/v/:appId` (shared viewer).
- Dashboard primary `View Report` link opens shared viewer route (`/v/:appId`)
- `/v/:appId` reads `competitor-raw-actionable.ko.json` on the server and returns embedded `html` directly (no client-side bundle bootstrap)
- Dashboard mode can display app icons when `data/{appId}/icon.png` exists
- Report page header also uses `data/{appId}/icon.png`; when missing, UI falls back to `appId` text
- Dashboard background fills the full viewport height (no abrupt cut when content is short).
- Single-file mode: serve one legacy HTML file with `--file`
- Serves preview state API for raw-review card management:
  - `GET /api/preview-state/:appId`
  - `PUT /api/preview-state/:appId`
  - persistence file: `data/{myAppId}/reports/preview-state.json`
- Serves backlog editing API:
  - `GET /api/backlog/:appId`
  - `PUT /api/backlog/:appId`
  - request/response `items[].evidenceReviewIds` must use scoped IDs (`sourceToken::reviewId`)
  - persistence file: `data/{myAppId}/reports/backlog.ko.json`

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
npm run report:preview -- --file data/aurora-eos/reports/competitor-raw-actionable.ko.html --port 4173  # legacy mode
```
