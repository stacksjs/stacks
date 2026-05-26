/**
 * Preview-server UI rendering (stacksjs/stacks#1900).
 *
 * Pure HTML/CSS — no JS framework, no client-side state, just a static
 * page that consumes the {@link MailablePreview} data from the
 * preview.ts module. Keeps the preview surface fast (no bundler step)
 * and isolated from the app's own UI (so a broken stx template can't
 * also break the preview itself).
 */

import type { DiscoveredMailable, MailablePreview } from './preview'

const ROOT = '/_stacks/mail/preview'

/** HTML-escape every char that could break out of a text or attribute. */
function escape(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[c] as string
  ))
}

/** Render the recipient line (To/Cc/Bcc) — accepts both string[] and EmailAddress[]. */
function fmtAddresses(addresses: Array<string | { name?: string, address: string }>): string {
  if (!addresses?.length) return '—'
  return addresses.map((a) => {
    if (typeof a === 'string') return escape(a)
    if (a.name) return `${escape(a.name)} &lt;${escape(a.address)}&gt;`
    return escape(a.address)
  }).join(', ')
}

/** Shared shell — minimal Tailwind-CDN-ish look without the bundler dependency. */
function shell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escape(title)} — Stacks Mail Preview</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f4f5; color: #111827; line-height: 1.5; }
    @media (prefers-color-scheme: dark) {
      body { background: #0a0a0a; color: #ededed; }
      .panel { background: #1a1a1a; border-color: #2a2a2a; }
      a { color: #818cf8; }
      .muted { color: #9ca3af; }
      pre { background: #2a2a2a; color: #ededed; }
    }
    header { padding: 16px 24px; background: #fff; border-bottom: 1px solid #e5e7eb; }
    @media (prefers-color-scheme: dark) { header { background: #1a1a1a; border-color: #2a2a2a; } }
    header h1 { margin: 0; font-size: 16px; font-weight: 600; }
    header h1 a { color: inherit; text-decoration: none; }
    header .crumb { font-size: 13px; color: #6b7280; }
    main { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: 220px 1fr; gap: 16px; }
    .pill { display: inline-block; padding: 2px 8px; font-size: 12px; border-radius: 999px; background: #eef2ff; color: #3730a3; }
    .toolbar { display: flex; gap: 8px; padding: 8px 0; flex-wrap: wrap; align-items: center; }
    .toolbar a { padding: 6px 12px; border: 1px solid #d1d5db; border-radius: 6px; text-decoration: none; color: inherit; font-size: 13px; }
    .toolbar a.active { background: #4f46e5; color: white; border-color: #4f46e5; }
    .muted { color: #6b7280; font-size: 13px; }
    iframe { width: 100%; min-height: 800px; border: 0; background: #fff; border-radius: 8px; }
    iframe.mobile { max-width: 375px; margin: 0 auto; display: block; min-height: 700px; }
    pre { background: #f3f4f6; padding: 12px; border-radius: 6px; overflow: auto; font-size: 12px; line-height: 1.5; max-height: 400px; }
    .meta { display: grid; grid-template-columns: 80px 1fr; gap: 6px 12px; font-size: 13px; }
    .meta dt { color: #6b7280; }
    .meta dd { margin: 0; }
    .empty { text-align: center; padding: 48px 24px; color: #6b7280; }
    ul.list { list-style: none; padding: 0; margin: 0; }
    ul.list li { padding: 12px; border-bottom: 1px solid #e5e7eb; }
    @media (prefers-color-scheme: dark) { ul.list li { border-color: #2a2a2a; } }
    ul.list li:last-child { border-bottom: 0; }
    ul.list a { color: inherit; text-decoration: none; font-weight: 500; }
    ul.list a:hover { color: #4f46e5; }
    .error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 6px; }
    @media (prefers-color-scheme: dark) { .error { background: #1f0a0a; border-color: #7f1d1d; color: #fca5a5; } }
  </style>
</head>
<body>
  <header>
    <h1><a href="${ROOT}">Mail Preview</a> <span class="crumb">${escape(title)}</span></h1>
  </header>
  <main>${body}</main>
</body>
</html>`
}

/**
 * Render the index page listing every discovered Mailable.
 */
export function renderIndexHtml(mailables: DiscoveredMailable[]): string {
  if (mailables.length === 0) {
    return shell('Index', `
      <div class="empty panel">
        <p>No Mailables found in <code>app/Mail/</code>.</p>
        <p class="muted">Run <code>./buddy make:mail Welcome</code> to scaffold one.</p>
      </div>
    `)
  }

  const items = mailables.map(m => `
    <li>
      <a href="${ROOT}/${escape(m.slug)}">${escape(m.name)}</a>
      <div class="muted">app/Mail/${escape(m.name)}.ts · template: ${escape(m.slug)}.stx</div>
    </li>
  `).join('')

  return shell('Index', `
    <div class="panel">
      <p class="muted">${mailables.length} mailable${mailables.length === 1 ? '' : 's'} discovered. Add sample props at
      <code>resources/emails/_previews/&lt;slug&gt;.ts</code> for richer previews.</p>
      <ul class="list">${items}</ul>
    </div>
  `)
}

/**
 * Render the preview page for a single Mailable. `view` controls the
 * iframe width: 'desktop' (default) / 'mobile' / 'text' (renders the
 * plain-text version instead of HTML).
 */
export function renderPreviewHtml(
  mailable: DiscoveredMailable,
  preview: MailablePreview,
  view: 'desktop' | 'mobile' | 'text' = 'desktop',
): string {
  const { inspection, text, sampleProps, error } = preview
  const baseUrl = `${ROOT}/${mailable.slug}`
  const rawUrl = `${baseUrl}/raw`

  const errorBlock = error
    ? `<div class="panel"><div class="error"><strong>${escape(mailable.name)} failed to render:</strong> ${escape(error)}</div></div>`
    : ''

  const iframeBlock = error
    ? ''
    : view === 'text'
      ? `<div class="panel"><pre>${escape(text || '(no plain-text body)')}</pre></div>`
      : `<div class="panel"><iframe src="${rawUrl}" class="${view === 'mobile' ? 'mobile' : ''}" title="${escape(mailable.name)} body" sandbox="allow-same-origin"></iframe></div>`

  const sampleHint = sampleProps
    ? `<dd><code>resources/emails/_previews/${escape(mailable.slug)}.ts</code></dd>`
    : `<dd class="muted">No sample file — edit <code>resources/emails/_previews/${escape(mailable.slug)}.ts</code> to customize.</dd>`

  return shell(mailable.name, `
    ${errorBlock}

    <div class="grid">
      <aside>
        <div class="panel">
          <dl class="meta">
            <dt>Subject</dt><dd>${escape(inspection.subject || '(no subject)')}</dd>
            <dt>To</dt><dd>${fmtAddresses(inspection.to as any)}</dd>
            ${inspection.cc?.length ? `<dt>Cc</dt><dd>${fmtAddresses(inspection.cc as any)}</dd>` : ''}
            ${inspection.bcc?.length ? `<dt>Bcc</dt><dd>${fmtAddresses(inspection.bcc as any)}</dd>` : ''}
            ${inspection.from ? `<dt>From</dt><dd>${fmtAddresses([inspection.from as any])}</dd>` : ''}
            ${inspection.replyTo ? `<dt>Reply-To</dt><dd>${fmtAddresses([inspection.replyTo as any])}</dd>` : ''}
            ${inspection.template ? `<dt>Template</dt><dd>${escape(inspection.template.name)}.stx</dd>` : ''}
            ${inspection.attachments?.length ? `<dt>Attachments</dt><dd>${inspection.attachments.length}</dd>` : ''}
          </dl>
        </div>

        <div class="panel">
          <h3 style="margin: 0 0 8px; font-size: 13px; font-weight: 600;">Sample props</h3>
          ${sampleHint}
          ${sampleProps ? `<pre>${escape(JSON.stringify(sampleProps, null, 2))}</pre>` : ''}
        </div>
      </aside>

      <section>
        <div class="toolbar">
          <a href="${baseUrl}" class="${view === 'desktop' ? 'active' : ''}">Desktop</a>
          <a href="${baseUrl}?view=mobile" class="${view === 'mobile' ? 'active' : ''}">Mobile</a>
          <a href="${baseUrl}?view=text" class="${view === 'text' ? 'active' : ''}">Text</a>
          <span class="muted" style="margin-left: auto;">${escape(mailable.name)}</span>
        </div>
        ${iframeBlock}
      </section>
    </div>
  `)
}
