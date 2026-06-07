/**
 * Laravel-style error page styles (v12.29+ local debug page).
 * Inline CSS — no external dependencies.
 */
export const ERROR_PAGE_CSS = `
  :root {
    --font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
    --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    --neutral-50: #fafafa;
    --neutral-100: #f5f5f5;
    --neutral-200: #e5e5e5;
    --neutral-300: #d4d4d4;
    --neutral-400: #a3a3a3;
    --neutral-500: #737373;
    --neutral-600: #525252;
    --neutral-700: #404040;
    --neutral-800: #262626;
    --neutral-900: #171717;
    --neutral-950: #0a0a0a;
    --rose-100: #ffe4e6;
    --rose-200: #fecdd3;
    --rose-500: #f43f5e;
    --rose-600: #e11d48;
    --rose-900: #881337;
    --rose-950: #4c0519;
    --blue-100: #dbeafe;
    --blue-500: #3b82f6;
    --blue-600: #2563eb;
    --blue-700: #1d4ed8;
    --blue-900: #1e3a8a;
    --emerald-500: #10b981;
    --amber-200: #fde68a;
    --amber-600: #d97706;
    --amber-900: #78350f;
    --white: #fff;
    --radius-md: 0.375rem;
    --radius-lg: 0.5rem;
    --radius-xl: 0.75rem;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html {
    -webkit-text-size-adjust: 100%;
    color-scheme: light dark;
  }

  body {
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: var(--neutral-50);
    color: var(--neutral-950);
    line-height: 1.5;
    min-height: 100dvh;
  }

  @media (prefers-color-scheme: dark) {
    body {
      background: var(--neutral-900);
      color: var(--white);
    }
  }

  .page {
    max-width: 80rem;
    margin: 0 auto;
    padding: 3.5rem 1.5rem 2rem;
  }

  @media (min-width: 640px) {
    .page { padding: 4rem 3.5rem 2rem; }
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 2rem;
    flex-wrap: wrap;
  }

  .header-title {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--neutral-600);
  }

  @media (prefers-color-scheme: dark) {
    .header-title { color: var(--neutral-400); }
  }

  .header-dot {
    width: 0.625rem;
    height: 0.625rem;
    border-radius: 9999px;
    background: var(--rose-500);
    flex-shrink: 0;
  }

  .btn-copy {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid var(--neutral-200);
    border-radius: var(--radius-md);
    background: var(--white);
    color: var(--neutral-700);
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .btn-copy:hover { background: var(--neutral-100); }
  .btn-copy.copied { border-color: var(--emerald-500); color: var(--emerald-500); }

  @media (prefers-color-scheme: dark) {
    .btn-copy {
      background: var(--neutral-800);
      border-color: rgba(255,255,255,0.1);
      color: var(--neutral-200);
    }
    .btn-copy:hover { background: rgba(255,255,255,0.05); }
  }

  /* ── Error summary card ── */
  .summary {
    margin-bottom: 2rem;
  }

  .summary h1 {
    font-size: 1.875rem;
    font-weight: 600;
    line-height: 1.2;
    margin-bottom: 0.75rem;
  }

  .summary-file {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--rose-600);
    margin-bottom: 0.75rem;
    word-break: break-all;
  }

  @media (prefers-color-scheme: dark) {
    .summary-file { color: var(--rose-500); }
  }

  .summary-message {
    font-size: 1.125rem;
    color: var(--neutral-800);
    margin-bottom: 1.25rem;
    word-break: break-word;
  }

  @media (prefers-color-scheme: dark) {
    .summary-message { color: var(--neutral-200); }
  }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    border-radius: var(--radius-md);
    border: 1px solid var(--neutral-200);
    background: var(--neutral-100);
    color: var(--neutral-600);
  }

  @media (prefers-color-scheme: dark) {
    .badge {
      border-color: rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.05);
      color: var(--neutral-400);
    }
  }

  .badge-status {
    background: var(--rose-100);
    border-color: var(--rose-200);
    color: var(--rose-900);
  }

  @media (prefers-color-scheme: dark) {
    .badge-status {
      background: var(--rose-950);
      border-color: var(--rose-900);
      color: var(--rose-100);
    }
  }

  .request-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
  }

  .badge-method {
    background: var(--blue-100);
    border-color: transparent;
    color: var(--blue-900);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
  }

  @media (prefers-color-scheme: dark) {
    .badge-method {
      background: var(--blue-700);
      color: var(--white);
    }
  }

  .request-url {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--neutral-500);
    word-break: break-all;
  }

  @media (prefers-color-scheme: dark) {
    .request-url { color: var(--neutral-400); }
  }

  /* ── Hints ── */
  .hints {
    border: 1px solid var(--amber-200);
    border-radius: var(--radius-lg);
    background: #fffbeb;
    margin-bottom: 2rem;
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    .hints {
      border-color: var(--amber-600);
      background: rgba(120, 53, 15, 0.3);
    }
  }

  .hints-header {
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--amber-900);
    border-bottom: 1px solid var(--amber-200);
  }

  @media (prefers-color-scheme: dark) {
    .hints-header { color: var(--amber-200); border-bottom-color: rgba(217,119,6,0.3); }
  }

  .hints-body {
    padding: 1rem;
    font-size: 0.875rem;
    color: var(--neutral-700);
  }

  @media (prefers-color-scheme: dark) {
    .hints-body { color: var(--neutral-300); }
  }

  .hints-body ul { margin: 0 0 0.75rem 1.25rem; }
  .hints-body li { margin: 0.2rem 0; }
  .hints-suggestion { font-weight: 500; margin-bottom: 0.5rem; }
  .hints-doc { color: var(--blue-600); text-decoration: none; font-size: 0.8125rem; }
  .hints-doc:hover { text-decoration: underline; }

  /* ── Exception trace ── */
  .trace {
    margin-bottom: 2rem;
  }

  .trace-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--neutral-500);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
  }

  @media (prefers-color-scheme: dark) {
    .trace-title { color: var(--neutral-400); }
  }

  .trace-frame {
    border: 1px solid var(--neutral-200);
    border-radius: var(--radius-lg);
    margin-bottom: 0.5rem;
    overflow: hidden;
    background: var(--white);
  }

  @media (prefers-color-scheme: dark) {
    .trace-frame {
      border-color: rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.02);
    }
  }

  .trace-frame-header {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    cursor: pointer;
    font-size: 0.8125rem;
    transition: background 0.15s;
  }

  .trace-frame-header:hover { background: var(--neutral-50); }

  @media (prefers-color-scheme: dark) {
    .trace-frame-header:hover { background: rgba(255,255,255,0.03); }
  }

  .trace-frame-fn {
    font-family: var(--font-mono);
    color: var(--neutral-800);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (prefers-color-scheme: dark) {
    .trace-frame-fn { color: var(--neutral-200); }
  }

  .trace-frame-file {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--neutral-400);
    flex-shrink: 0;
  }

  .trace-frame-body {
    display: none;
    border-top: 1px solid var(--neutral-200);
  }

  .trace-frame.expanded .trace-frame-body { display: block; }

  @media (prefers-color-scheme: dark) {
    .trace-frame-body { border-top-color: rgba(255,255,255,0.08); }
  }

  .trace-vendor {
    border: 1px dashed var(--neutral-300);
    border-radius: var(--radius-lg);
    margin-bottom: 0.5rem;
    overflow: hidden;
  }

  @media (prefers-color-scheme: dark) {
    .trace-vendor { border-color: rgba(255,255,255,0.15); }
  }

  .trace-vendor-toggle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--neutral-500);
    cursor: pointer;
    background: var(--neutral-50);
    transition: background 0.15s;
  }

  .trace-vendor-toggle:hover { background: var(--neutral-100); }

  @media (prefers-color-scheme: dark) {
    .trace-vendor-toggle {
      background: rgba(255,255,255,0.03);
      color: var(--neutral-400);
    }
    .trace-vendor-toggle:hover { background: rgba(255,255,255,0.05); }
  }

  .trace-vendor-frames { display: none; padding: 0.25rem 0; }
  .trace-vendor.expanded .trace-vendor-frames { display: block; }

  /* ── Code snippet ── */
  .code-block {
    overflow-x: auto;
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.6;
    background: var(--neutral-950);
    color: #abb2bf;
  }

  .code-line {
    display: flex;
    min-height: 1.5rem;
  }

  .code-line:nth-child(odd) { background: rgba(255,255,255,0.02); }
  .code-line:nth-child(even) { background: rgba(255,255,255,0.04); }

  .code-line.highlight {
    background: rgba(244, 63, 94, 0.25) !important;
  }

  .code-ln {
    width: 3.5rem;
    text-align: right;
    padding: 0 1rem 0 0.5rem;
    color: var(--neutral-500);
    user-select: none;
    flex-shrink: 0;
  }

  .code-line.highlight .code-ln { color: var(--rose-500); }

  .code-txt {
    flex: 1;
    padding-right: 1rem;
    white-space: pre;
  }

  /* ── Context panels ── */
  .context {
    margin-bottom: 2rem;
  }

  .context-tabs {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--neutral-200);
    overflow-x: auto;
  }

  @media (prefers-color-scheme: dark) {
    .context-tabs { border-bottom-color: rgba(255,255,255,0.1); }
  }

  .context-tab {
    padding: 0.625rem 1rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--neutral-500);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    cursor: pointer;
    white-space: nowrap;
    transition: color 0.15s;
  }

  .context-tab:hover { color: var(--neutral-800); }
  .context-tab.active {
    color: var(--rose-600);
    border-bottom-color: var(--rose-500);
  }

  @media (prefers-color-scheme: dark) {
    .context-tab:hover { color: var(--neutral-200); }
    .context-tab.active { color: var(--rose-500); }
  }

  .context-panel {
    display: none;
    padding: 1.25rem 0;
  }

  .context-panel.active { display: block; }

  .kv-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .kv-table tr {
    border-bottom: 1px solid var(--neutral-100);
  }

  @media (prefers-color-scheme: dark) {
    .kv-table tr { border-bottom-color: rgba(255,255,255,0.05); }
  }

  .kv-table td {
    padding: 0.5rem 0.75rem;
    vertical-align: top;
  }

  .kv-table td:first-child {
    font-weight: 500;
    color: var(--neutral-500);
    width: 30%;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    word-break: break-all;
  }

  @media (prefers-color-scheme: dark) {
    .kv-table td:first-child { color: var(--neutral-400); }
  }

  .kv-table td:last-child {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    word-break: break-all;
    color: var(--neutral-800);
  }

  @media (prefers-color-scheme: dark) {
    .kv-table td:last-child { color: var(--neutral-200); }
  }

  .query-item {
    padding: 0.75rem 1rem;
    margin-bottom: 0.5rem;
    border: 1px solid var(--neutral-200);
    border-radius: var(--radius-md);
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: var(--neutral-50);
  }

  @media (prefers-color-scheme: dark) {
    .query-item {
      border-color: rgba(255,255,255,0.08);
      background: rgba(255,255,255,0.03);
    }
  }

  .query-time {
    margin-top: 0.375rem;
    font-size: 0.6875rem;
    color: var(--neutral-400);
  }

  .json-block {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    background: var(--neutral-100);
    border-radius: var(--radius-md);
    padding: 1rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
  }

  @media (prefers-color-scheme: dark) {
    .json-block {
      background: rgba(255,255,255,0.05);
      color: var(--neutral-200);
    }
  }

  /* ── Production page ── */
  .production-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100dvh;
    text-align: center;
    padding: 2rem;
  }

  .production-status {
    font-size: 6rem;
    font-weight: 700;
    color: var(--neutral-200);
    margin-bottom: 1rem;
    line-height: 1;
  }

  @media (prefers-color-scheme: dark) {
    .production-status { color: var(--neutral-700); }
  }

  .production-title {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .production-message {
    color: var(--neutral-500);
    margin-bottom: 2rem;
    max-width: 28rem;
  }

  .production-link {
    color: var(--blue-600);
    text-decoration: none;
    font-size: 0.875rem;
  }

  .production-link:hover { text-decoration: underline; }

  @media (prefers-color-scheme: dark) {
    .production-link { color: var(--blue-500); }
  }
`
