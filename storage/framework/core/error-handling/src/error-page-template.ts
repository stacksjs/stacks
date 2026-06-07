import { ERROR_PAGE_CSS } from './error-page-styles'

export interface ParsedFrame {
  file: string
  line: number
  column?: number
  function?: string
  absoluteFile: string
  isFramework: boolean
}

interface QueryInfo {
  query: string
  time?: number
  connection?: string
}

interface RequestContext {
  method: string
  url: string
  headers: Record<string, string>
  queryParams?: Record<string, string>
  body?: unknown
}

interface RoutingContext {
  controller?: string
  routeName?: string
  middleware?: string[]
}

interface UserContext {
  id?: string | number
  email?: string
  name?: string
}

export interface CodeSnippetResult {
  lines: Array<{ number: number, content: string, highlight: boolean }>
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Read source lines around a stack frame for the code snippet panel.
 */
export function readCodeSnippet(
  filePath: string,
  line: number,
  radius: number = 6,
): CodeSnippetResult | null {
  try {
    // eslint-disable-next-line ts/no-require-imports
    const fs = require('node:fs') as typeof import('node:fs')
    if (!filePath || !fs.existsSync(filePath)) return null
    const content = fs.readFileSync(filePath, 'utf-8')
    const allLines = content.split('\n')
    const start = Math.max(0, line - radius - 1)
    const end = Math.min(allLines.length, line + radius)
    return {
      lines: allLines.slice(start, end).map((code, i) => ({
        number: start + i + 1,
        content: code,
        highlight: start + i + 1 === line,
      })),
    }
  }
  catch {
    return null
  }
}

export function renderCodeSnippet(snippet: CodeSnippetResult): string {
  return `<div class="code-block">${snippet.lines.map(l => `
    <div class="code-line${l.highlight ? ' highlight' : ''}">
      <span class="code-ln">${l.number}</span>
      <span class="code-txt">${escapeHtml(l.content || ' ')}</span>
    </div>`).join('')}
  </div>`
}

export function renderTraceFrame(frame: ParsedFrame, index: number, snippetLines: number): string {
  const snippet = readCodeSnippet(frame.absoluteFile, frame.line, snippetLines)
  const snippetHtml = snippet ? renderCodeSnippet(snippet) : ''
  const expanded = index === 0 ? ' expanded' : ''

  return `<div class="trace-frame${expanded}" data-frame>
    <div class="trace-frame-header" onclick="this.parentElement.classList.toggle('expanded')">
      <span class="trace-frame-fn">${escapeHtml(frame.function || '<anonymous>')}</span>
      <span class="trace-frame-file">${escapeHtml(frame.file)}:${frame.line}</span>
    </div>
    ${snippetHtml ? `<div class="trace-frame-body">${snippetHtml}</div>` : ''}
  </div>`
}

export function renderVendorGroup(frames: ParsedFrame[], snippetLines: number): string {
  const count = frames.length
  const label = count === 1 ? '1 framework frame' : `${count} framework frames`
  const inner = frames.map((f, i) => renderTraceFrame(f, i + 1, snippetLines)).join('')

  return `<div class="trace-vendor" data-vendor-group>
    <div class="trace-vendor-toggle" onclick="this.parentElement.classList.toggle('expanded')">
      <span>${escapeHtml(label)}</span>
    </div>
    <div class="trace-vendor-frames">${inner}</div>
  </div>`
}

export function groupTraceFrames(frames: ParsedFrame[]): Array<ParsedFrame | ParsedFrame[]> {
  const groups: Array<ParsedFrame | ParsedFrame[]> = []
  let vendorBatch: ParsedFrame[] = []

  const flushVendor = () => {
    if (vendorBatch.length > 0) {
      groups.push(vendorBatch.length === 1 ? vendorBatch[0]! : [...vendorBatch])
      vendorBatch = []
    }
  }

  for (const frame of frames) {
    if (frame.isFramework) {
      vendorBatch.push(frame)
    }
    else {
      flushVendor()
      groups.push(frame)
    }
  }
  flushVendor()
  return groups
}

export function renderExceptionTrace(frames: ParsedFrame[], snippetLines: number): string {
  if (frames.length === 0) return ''

  const groups = groupTraceFrames(frames)
  const rendered = groups.map((group, i) => {
    if (Array.isArray(group)) {
      return renderVendorGroup(group, snippetLines)
    }
    return renderTraceFrame(group, i, snippetLines)
  }).join('')

  return `<section class="trace">
    <h2 class="trace-title">Exception trace</h2>
    ${rendered}
  </section>`
}

export function renderContextTabs(opts: {
  request?: RequestContext
  routing?: RoutingContext
  user?: UserContext
  queries?: QueryInfo[]
  showEnvironment?: boolean
}): string {
  const tabs: Array<{ id: string, label: string, html: string }> = []

  if (opts.request) {
    const headerRows = Object.entries(opts.request.headers)
      .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
      .join('')

    tabs.push({
      id: 'headers',
      label: 'Headers',
      html: headerRows
        ? `<table class="kv-table">${headerRows}</table>`
        : '<p style="color:var(--neutral-500);font-size:0.875rem">No headers</p>',
    })

    const bodyContent = opts.request.body
      ? `<div class="json-block">${escapeHtml(JSON.stringify(opts.request.body, null, 2))}</div>`
      : '<p style="color:var(--neutral-500);font-size:0.875rem">// No request body</p>'

    tabs.push({
      id: 'body',
      label: 'Body',
      html: bodyContent,
    })
  }

  if (opts.routing) {
    const rows = [
      opts.routing.controller ? `<tr><td>controller</td><td>${escapeHtml(opts.routing.controller)}</td></tr>` : '',
      opts.routing.routeName ? `<tr><td>route name</td><td>${escapeHtml(opts.routing.routeName)}</td></tr>` : '',
      opts.routing.middleware?.length
        ? `<tr><td>middleware</td><td>${escapeHtml(opts.routing.middleware.join(', '))}</td></tr>`
        : '',
    ].filter(Boolean).join('')

    if (rows) {
      tabs.push({
        id: 'routing',
        label: 'Routing',
        html: `<table class="kv-table">${rows}</table>`,
      })
    }
  }

  if (opts.user) {
    const rows = [
      opts.user.id !== undefined ? `<tr><td>id</td><td>${escapeHtml(String(opts.user.id))}</td></tr>` : '',
      opts.user.email ? `<tr><td>email</td><td>${escapeHtml(opts.user.email)}</td></tr>` : '',
      opts.user.name ? `<tr><td>name</td><td>${escapeHtml(opts.user.name)}</td></tr>` : '',
    ].filter(Boolean).join('')

    if (rows) {
      tabs.push({
        id: 'user',
        label: 'User',
        html: `<table class="kv-table">${rows}</table>`,
      })
    }
  }

  if (opts.queries && opts.queries.length > 0) {
    tabs.push({
      id: 'queries',
      label: `Queries (${opts.queries.length})`,
      html: opts.queries.map(q => `
        <div class="query-item">
          ${escapeHtml(q.query)}
          ${q.time !== undefined ? `<div class="query-time">${q.time.toFixed(2)}ms${q.connection ? ` • ${escapeHtml(q.connection)}` : ''}</div>` : ''}
        </div>`).join(''),
    })
  }

  if (opts.showEnvironment) {
    tabs.push({
      id: 'environment',
      label: 'Environment',
      html: `<table class="kv-table">
        <tr><td>runtime</td><td>${typeof process !== 'undefined' ? escapeHtml(process.version) : 'N/A'}</td></tr>
        <tr><td>platform</td><td>${typeof process !== 'undefined' ? escapeHtml(process.platform) : 'N/A'}</td></tr>
        <tr><td>arch</td><td>${typeof process !== 'undefined' ? escapeHtml(process.arch) : 'N/A'}</td></tr>
      </table>`,
    })
  }

  if (tabs.length === 0) return ''

  const tabButtons = tabs.map((t, i) =>
    `<button class="context-tab${i === 0 ? ' active' : ''}" data-tab="${t.id}" type="button">${escapeHtml(t.label)}</button>`,
  ).join('')

  const panels = tabs.map((t, i) =>
    `<div class="context-panel${i === 0 ? ' active' : ''}" data-panel="${t.id}">${t.html}</div>`,
  ).join('')

  return `<section class="context">
    <div class="context-tabs">${tabButtons}</div>
    ${panels}
  </section>`
}

export function buildErrorMarkdown(opts: {
  statusTitle: string
  errorName: string
  errorMessage: string
  status: number
  file?: string
  line?: number
  request?: RequestContext
  framework?: { name: string, version?: string }
  frames: ParsedFrame[]
}): string {
  const lines: string[] = [
    `# ${opts.statusTitle}`,
    '',
    `## ${opts.errorName}`,
    '',
    opts.errorMessage,
    '',
  ]

  if (opts.file) {
    lines.push(`**${opts.file}${opts.line ? `:${opts.line}` : ''}**`, '')
  }

  if (opts.framework) {
    lines.push(`**${opts.framework.name.toUpperCase()}** ${opts.framework.version ?? ''}`.trim(), '')
  }

  lines.push(`**${opts.status}**`, '')

  if (opts.request) {
    lines.push(`\`${opts.request.method}\` ${opts.request.url}`, '')
  }

  if (opts.frames.length > 0) {
    lines.push('## Exception trace', '')
    for (const frame of opts.frames.slice(0, 20)) {
      lines.push(`\`${frame.function || '<anonymous>'}\` — ${frame.file}:${frame.line}`)
    }
  }

  return lines.join('\n')
}

export const ERROR_PAGE_SCRIPT = `
function initErrorPage() {
  const copyBtn = document.getElementById('copy-markdown');
  const markdown = document.getElementById('error-markdown');
  if (copyBtn && markdown) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(markdown.textContent || '');
        copyBtn.textContent = 'Copied!';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = 'Copy as Markdown';
          copyBtn.classList.remove('copied');
        }, 2000);
      } catch {
        copyBtn.textContent = 'Copy failed';
      }
    });
  }

  document.querySelectorAll('.context-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const id = tab.getAttribute('data-tab');
      document.querySelectorAll('.context-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.context-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.querySelector('[data-panel="' + id + '"]');
      if (panel) panel.classList.add('active');
    });
  });
}
document.addEventListener('DOMContentLoaded', initErrorPage);
`

export function wrapErrorPage(body: string, markdown: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${ERROR_PAGE_CSS}</style>
</head>
<body>
  <div class="page">
    ${body}
  </div>
  <script id="error-markdown" type="text/plain">${escapeHtml(markdown)}</script>
  <script>${ERROR_PAGE_SCRIPT}</script>
</body>
</html>`
}
