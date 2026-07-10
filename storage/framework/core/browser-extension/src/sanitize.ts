/**
 * Sanitize an stx-built page for use as an extension page.
 *
 * MV3 extension pages run under a strict CSP (`script-src 'self'`) — no inline
 * `<script>` or `<style>`, and asset URLs must be relative (the page loads from
 * `chrome-extension://…/<name>.html`, not a web root). stx emits dev niceties
 * (SEO meta, an inline style block, an inline hydration script) and absolute
 * `/asset` paths, so strip/rewrite them, keeping only the page's own compiled
 * script(s).
 */
export function sanitizeExtensionHtml(html: string, ownScripts: string[]): string {
  // Keep `<script src="<ownScript>">` — drop every other inline/injected script.
  const keep = ownScripts
    .map(s => `(?![^>]*src="/?${s.replace('.', '\\.')}")`)
    .join('')

  let out = html
    .replace(/\n?<!-- stx SEO Tags -->[\s\S]*?(?=\n\s*<meta charset=)/, '')
    .replace(/\n?\s*<style\b[\s\S]*?<\/style>/g, '')
    .replace(new RegExp(`\\n?\\s*<script\\b${keep}[\\s\\S]*?<\\/script>`, 'g'), '')
    .replaceAll('href="/styles.css"', 'href="styles.css"')
    .replaceAll('href="/icons/', 'href="icons/')

  for (const s of ownScripts)
    out = out.replaceAll(`src="/${s}"`, `src="${s}"`)

  return out
}
