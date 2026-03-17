import path from "node:path";

export interface ReportEntry {
  fileName: string;
  href: string;
}

export interface AppReports {
  appId: string;
  iconHref?: string;
  reports: ReportEntry[];
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fileExtLabel(fileName: string): string {
  return path.extname(fileName).toLowerCase().replace(".", "").toUpperCase();
}

function pickPrimaryReport(reports: ReportEntry[]): ReportEntry {
  const primaryHtml = reports.find((report) => path.extname(report.fileName).toLowerCase() === ".html");
  return primaryHtml ?? reports[0];
}

export function renderHomeHtml(apps: AppReports[], filterAppId?: string): string {
  const totalReports = apps.reduce((sum, app) => sum + app.reports.length, 0);
  const cards = apps
    .map((app) => {
      const primaryReport = pickPrimaryReport(app.reports);
      const viewerHref = `/v/${encodeURIComponent(app.appId)}`;
      const referenceReports = app.reports.filter((report) => report !== primaryReport);
      const iconBlock = app.iconHref
        ? `<img class=\"app-icon\" src=\"${escapeHtml(app.iconHref)}\" alt=\"${escapeHtml(
            app.appId
          )} icon\" loading=\"lazy\" decoding=\"async\" />`
        : "";

      const referenceLinks = referenceReports
        .map((report) => {
          const ext = fileExtLabel(report.fileName);
          return `<a class=\"file-link\" href=\"${escapeHtml(report.href)}\">${escapeHtml(report.fileName)} <span class=\"tag\">${ext}</span></a>`;
        })
        .join("\n");

      const referenceSection =
        referenceReports.length > 0
          ? `
          <details class=\"refs\">
            <summary>Reference files (${referenceReports.length})</summary>
            <div class=\"links refs-links\">${referenceLinks}</div>
          </details>
        `
          : "";

      return `
        <section class=\"card searchable\" data-search=\"${escapeHtml(
          `${app.appId} ${app.reports.map((x) => x.fileName).join(" ")}`
        ).toLowerCase()}\">
          <div class=\"card-head\">
            ${iconBlock}
            <h2>${escapeHtml(app.appId)}</h2>
          </div>
          <a class=\"file-link file-link-main\" href=\"${escapeHtml(viewerHref)}\">
            <span class=\"main-link-text\">
              <span class=\"main-link-title\">View Report</span>
              <span class=\"main-link-meta\">Shared viewer · ${escapeHtml(app.appId)}</span>
            </span>
          </a>
          ${referenceSection}
        </section>
      `;
    })
    .join("\n");

  const infoLine = filterAppId ? `Filter: <code>${escapeHtml(filterAppId)}</code>` : "All app reports";

  const emptyState = `
    <div class=\"empty\">
      <p>No reports found.</p>
      <p>Generate a report first with:</p>
      <pre>npm run report:render-html -- --my-app &lt;owner&gt;</pre>
    </div>
  `;

  return `<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Report Preview Dashboard</title>
    <style>
      :root {
        --bg: #f3f7fc;
        --bg-layer: #eef4fb;
        --panel: #ffffff;
        --panel-soft: #f8fbff;
        --ink: #0f172a;
        --sub: #475569;
        --line: #d8e3f0;
        --line-strong: #b8ccdf;
        --accent: #0ea5e9;
        --accent-soft: rgba(14, 165, 233, 0.14);
        --shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
      }
      * { box-sizing: border-box; }
      html,
      body {
        min-height: 100%;
      }
      html {
        background:
          radial-gradient(circle at 0% 0%, #d8e9fb 0%, rgba(216, 233, 251, 0) 34%),
          radial-gradient(circle at 92% 8%, #d9f0ff 0%, rgba(217, 240, 255, 0) 40%),
          linear-gradient(180deg, var(--bg-layer) 0%, var(--bg) 100%);
        background-color: var(--bg);
      }
      body {
        margin: 0;
        min-height: 100dvh;
        font-family: "Manrope", "Pretendard", "Segoe UI", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at 0% 0%, #d8e9fb 0%, rgba(216, 233, 251, 0) 34%),
          radial-gradient(circle at 92% 8%, #d9f0ff 0%, rgba(217, 240, 255, 0) 40%),
          linear-gradient(180deg, var(--bg-layer) 0%, var(--bg) 100%);
        background-color: var(--bg);
      }
      .wrap {
        max-width: 1220px;
        margin: 0 auto;
        padding: 34px 16px 52px;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 2rem;
        letter-spacing: -0.02em;
      }
      .hero {
        border: 1px solid var(--line);
        border-radius: 18px;
        background: linear-gradient(165deg, #ffffff, #f5faff);
        box-shadow: var(--shadow);
        padding: 20px;
        margin-bottom: 16px;
      }
      .sub {
        margin: 0;
        color: var(--sub);
        font-size: 14px;
      }
      .hero-stats {
        margin-top: 14px;
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }
      .hero-stat {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: var(--panel);
        padding: 6px 10px;
        font-size: 12px;
        color: var(--sub);
      }
      .hero-stat strong {
        color: var(--ink);
      }
      .toolbar {
        margin-bottom: 18px;
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      .search-shell {
        width: min(560px, 100%);
        display: inline-flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.9);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 10px 12px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
      }
      .search-label {
        color: var(--sub);
        font-size: 14px;
        font-weight: 700;
      }
      .toolbar input {
        width: 100%;
        border: 0;
        background: transparent;
        color: var(--ink);
        padding: 0;
        font-size: 15px;
      }
      .toolbar input::placeholder {
        color: #7b8ba2;
      }
      .toolbar input:focus {
        outline: none;
      }
      .search-shell:focus-within {
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-soft);
      }
      .results-meta {
        margin: 0;
        padding: 7px 12px;
        border-radius: 999px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.88);
        color: var(--sub);
        font-size: 12px;
        font-weight: 700;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: 14px;
        align-items: start;
      }
      .card {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: var(--panel);
        padding: 14px;
        position: relative;
        box-shadow: var(--shadow);
        transition: transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease;
      }
      .card::before {
        content: "";
        position: absolute;
        inset: 0;
        border-radius: inherit;
        border: 1px solid transparent;
        pointer-events: none;
        background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(56, 189, 248, 0)) border-box;
        mask: linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0);
        mask-composite: exclude;
      }
      .card:hover {
        transform: translateY(-2px);
        border-color: var(--line-strong);
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
      }
      .card h2 {
        margin: 0;
        font-size: 1.1rem;
        line-height: 1.2;
        word-break: break-word;
      }
      .card-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .app-icon {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        object-fit: cover;
        border: 1px solid var(--line);
        flex: 0 0 auto;
        background: #f5f9ff;
      }
      .links {
        display: grid;
        gap: 8px;
      }
      .file-link {
        text-decoration: none;
        color: var(--ink);
        border: 1px solid var(--line);
        border-radius: 11px;
        padding: 9px 11px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: var(--panel-soft);
        transition: border-color 120ms ease, transform 120ms ease, color 120ms ease;
      }
      .file-link:hover {
        border-color: var(--accent);
        color: var(--accent);
        transform: translateY(-1px);
      }
      .file-link-main {
        background: linear-gradient(160deg, rgba(14, 165, 233, 0.16), rgba(14, 165, 233, 0.06));
        border-color: rgba(14, 165, 233, 0.38);
        font-weight: 600;
        margin-bottom: 12px;
        justify-content: flex-start;
      }
      .main-link-text {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
      }
      .main-link-title {
        font-size: 1rem;
        line-height: 1.25;
      }
      .main-link-meta {
        font-size: 12px;
        color: var(--sub);
        font-weight: 500;
        word-break: break-all;
      }
      .refs {
        border-top: 1px dashed var(--line);
        padding-top: 10px;
      }
      .refs summary {
        cursor: pointer;
        color: var(--sub);
        font-size: 13px;
        margin-bottom: 8px;
        list-style: none;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
      }
      .refs summary::after {
        content: "";
        width: 9px;
        height: 9px;
        border-right: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        transform: rotate(-45deg);
        transform-origin: 50% 50%;
        transition: transform 140ms ease;
        flex: 0 0 auto;
      }
      .refs summary::-webkit-details-marker { display: none; }
      .refs[open] summary {
        color: var(--ink);
      }
      .refs[open] summary::after {
        transform: rotate(45deg);
      }
      .refs-links .file-link {
        font-size: 13px;
      }
      .tag {
        font-size: 11px;
        color: var(--sub);
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 2px 7px;
      }
      .empty {
        border: 1px dashed var(--line);
        border-radius: 14px;
        background: var(--panel);
        padding: 18px;
        color: var(--sub);
      }
      .empty pre {
        margin: 10px 0 0;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #f8fbff;
        color: #31435f;
        padding: 10px;
        overflow-x: auto;
      }
      .hidden { display: none; }
      @media (max-width: 680px) {
        h1 {
          font-size: 1.64rem;
        }
        .wrap {
          padding-top: 26px;
        }
        .grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class=\"wrap\">
      <h1>Report Preview Dashboard</h1>
      <section class=\"hero\">
        <p class=\"sub\">${infoLine} · Open the main HTML first, then expand references if needed.</p>
        <div class=\"hero-stats\">
          <span class=\"hero-stat\"><strong>${apps.length}</strong> apps</span>
          <span class=\"hero-stat\"><strong>${totalReports}</strong> reports</span>
        </div>
      </section>
      <div class=\"toolbar\">
        <label class=\"search-shell\">
          <span class=\"search-label\">Find</span>
          <input id=\"search\" type=\"search\" placeholder=\"Search by app ID or file name\" />
        </label>
        <p id=\"resultsMeta\" class=\"results-meta\">${apps.length} / ${apps.length} apps</p>
      </div>
      ${apps.length ? `<section class=\"grid\" id=\"grid\">${cards}</section>` : emptyState}
    </main>
    <script>
      const input = document.getElementById('search');
      const resultsMeta = document.getElementById('resultsMeta');
      const cards = Array.from(document.querySelectorAll('.searchable'));
      function syncResultMeta() {
        if (!(resultsMeta instanceof HTMLElement)) {
          return;
        }
        const visibleCount = cards.filter((card) => !card.classList.contains('hidden')).length;
        resultsMeta.textContent = visibleCount + ' / ' + cards.length + ' apps';
      }
      if (input) {
        input.addEventListener('input', () => {
          const q = input.value.trim().toLowerCase();
          cards.forEach((card) => {
            const text = (card.getAttribute('data-search') || '').toLowerCase();
            const visible = !q || text.includes(q);
            card.classList.toggle('hidden', !visible);
          });
          syncResultMeta();
        });
      }
      syncResultMeta();
    </script>
  </body>
</html>`;
}

export function renderSharedViewerHtml(appId: string, bundleFileName: string): string {
  const safeAppId = escapeHtml(appId);
  const bundleHref = `/r/${encodeURIComponent(appId)}/${encodeURIComponent(bundleFileName)}`;
  const homeHref = "/";

  return `<!doctype html>
<html lang=\"en\">
  <head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>${safeAppId} Report Viewer</title>
    <style>
      :root {
        --bg: #f3f7fc;
        --bg-layer: #eef4fb;
        --panel: #ffffff;
        --ink: #0f172a;
        --sub: #475569;
        --line: #d8e3f0;
        --accent: #0ea5e9;
        --accent-soft: rgba(14, 165, 233, 0.14);
        --shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
      }
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background:
          radial-gradient(circle at 0% 0%, #d8e9fb 0%, rgba(216, 233, 251, 0) 34%),
          radial-gradient(circle at 92% 8%, #d9f0ff 0%, rgba(217, 240, 255, 0) 40%),
          linear-gradient(180deg, var(--bg-layer) 0%, var(--bg) 100%);
        color: var(--ink);
        font-family: "Manrope", "Pretendard", "Segoe UI", sans-serif;
      }
      .boot {
        display: grid;
        place-items: center;
        height: 100%;
        padding: 24px;
      }
      .boot-card {
        width: min(720px, 100%);
        text-align: center;
        border: 1px solid var(--line);
        border-radius: 16px;
        background: linear-gradient(165deg, #ffffff, #f5faff);
        box-shadow: var(--shadow);
        padding: 22px;
      }
      .boot h1 { margin: 0 0 10px; font-size: 1.05rem; font-weight: 700; }
      .boot p { margin: 0 0 10px; color: var(--sub); }
      .boot a { color: var(--accent); text-decoration: none; font-weight: 600; }
      .boot a:hover { text-decoration: underline; }
      .err {
        max-width: 720px;
        white-space: pre-wrap;
        word-break: break-word;
        text-align: left;
        background: #f8fbff;
        border: 1px solid var(--line);
        border-radius: 10px;
        padding: 12px;
        margin-top: 12px;
      }
    </style>
  </head>
  <body>
    <div id=\"boot\" class=\"boot\">
      <div class=\"boot-card\">
        <h1>Loading report for ${safeAppId}...</h1>
        <p>Using shared viewer + per-app report bundle</p>
        <p><a href=\"${homeHref}\">Back to home</a></p>
      </div>
    </div>
    <script>
      (async function bootstrap() {
        const bundleUrl = ${JSON.stringify(bundleHref)};
        try {
          const response = await fetch(bundleUrl, { method: "GET" });
          if (!response.ok) {
            throw new Error("Bundle request failed (" + response.status + "): " + bundleUrl);
          }
          const payload = await response.json();
          const html = payload && typeof payload.html === "string" ? payload.html : "";
          if (!html.trim()) {
            throw new Error("Bundle missing 'html' content: " + bundleUrl);
          }
          document.open();
          document.write(html);
          document.close();
        } catch (error) {
          const node = document.getElementById("boot");
          if (!node) {
            return;
          }
          const message = error instanceof Error ? error.message : String(error);
          const safeMessage = message
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
          node.innerHTML =
            "<div><h1>Failed to load report bundle</h1>" +
            "<p>App: ${safeAppId}</p>" +
            "<p><a href=\\\"${homeHref}\\\">Back to home</a></p>" +
            "<div class=\\\"err\\\">" + safeMessage + "</div>" +
            "</div>";
        }
      })();
    </script>
  </body>
</html>`;
}
