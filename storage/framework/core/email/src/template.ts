import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { fs } from '@stacksjs/storage'
import { defaultsResourcesPath, resourcesPath } from '@stacksjs/path'
import { join } from 'node:path'
import { inlineCss, shouldInlineByDefault } from './css-inliner'

export interface TemplateResult {
  html: string
  text: string
}

/**
 * Marker wrapper for variable values that contain pre-rendered HTML and
 * should NOT be escaped during {@link replaceVariables}. Constructed via
 * the {@link safe} helper.
 *
 * Anything that isn't a `SafeHtml` instance (or `safe`-marked) is treated
 * as untrusted text and runs through HTML escaping — this is the M-1
 * fix for stacksjs/stacks#1871 (template XSS via unescaped variable
 * interpolation).
 */
export class SafeHtml {
  readonly __safeHtml = true as const
  constructor(public readonly value: string) {}
}

/**
 * Mark a string as pre-rendered HTML so {@link replaceVariables} splices
 * it in verbatim instead of escaping. Use ONLY for content that you
 * authored (or that came from a trusted renderer like the framework's
 * own layout-slot resolution) — never for user input.
 *
 * @example
 * ```ts
 * mail.send({
 *   template: 'invoice',
 *   variables: {
 *     // User-supplied — escaped automatically (good)
 *     userName: req.input('name'),
 *     // Pre-rendered HTML you built yourself — opt out of escaping
 *     invoiceTable: safe(renderInvoiceTable(rows)),
 *   },
 * })
 * ```
 */
export function safe(html: string): SafeHtml {
  return new SafeHtml(html)
}

/** Allowed types for email template variable values */
export type TemplateVariableValue = string | number | boolean | undefined | null | SafeHtml

/** Map of variable names to their values for template replacement */
export type TemplateVariables = Record<string, TemplateVariableValue>

export interface TemplateOptions {
  /** Template variables to replace */
  variables?: TemplateVariables
  /** Layout to wrap the template in (default: 'base', ignored for .stx templates) */
  layout?: string | false
  /** Subject line for the email */
  subject?: string
  /**
   * Run the CSS inliner over the rendered HTML before returning.
   * Defaults to ON when `APP_ENV` / `NODE_ENV` is `production`,
   * OFF in dev so previews show the un-mutated stx output. Pass
   * `inline: true` from a one-off send to force inlining outside
   * prod (useful for staging-deploy email QA).
   *
   * stacksjs/stacks#1902 (B2).
   */
  inline?: boolean
}

/**
 * Get default template variables from config
 */
function getDefaultVariables(): TemplateVariables {
  const primaryColor = config.app.primaryColor || '#3b82f6'

  return {
    appName: config.app.name || 'Stacks',
    appUrl: config.app.url || 'https://localhost',
    primaryColor,
    primaryColorDark: darkenColor(primaryColor, 15),
    year: new Date().getFullYear(),
  }
}

/**
 * Darken a hex color by a percentage
 */
function darkenColor(hex: string, percent: number): string {
  const num = Number.parseInt(hex.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.max(0, (num >> 16) - amt)
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt)
  const B = Math.max(0, (num & 0x0000FF) - amt)
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`
}

/**
 * HTML-escape every char that could break out of a text node into an
 * attribute / tag context. The five-char set is the OWASP minimum for
 * "in a text node or quoted attribute"; we don't need the more
 * paranoid (forward-slash, equals, etc.) set because the template uses
 * `{{ … }}` only inside the document body, never inside `<script>` /
 * `<style>` / unquoted attribute slots.
 *
 * Constructed once at module load — a `replace` chain is faster than a
 * single regex for short strings.
 */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Replace template variables in HTML.
 *
 * Strings (and number / boolean coercions) are HTML-escaped before
 * interpolation. To opt OUT of escaping for a specific value — e.g.
 * pre-rendered HTML produced by the framework's layout-slot
 * resolution, or a chunk you authored yourself — wrap the value in
 * {@link safe} or pass a {@link SafeHtml} instance directly.
 *
 * Previously every value was spliced in raw via `String(value ?? '')`,
 * which let any caller-controlled variable contribute arbitrary HTML
 * (and JavaScript via `<img onerror>` etc.) to the rendered email body.
 * See stacksjs/stacks#1871 M-1.
 */
function replaceVariables(html: string, variables: TemplateVariables): string {
  let result = html

  for (const [key, value] of Object.entries(variables)) {
    // Replace {{ variable }} syntax (with optional whitespace)
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`\\{\\{\\s*${escapedKey}\\s*\\}\\}`, 'g')
    result = result.replace(regex, renderTemplateValue(value))
  }

  return result
}

/**
 * Render a single template variable. `SafeHtml` values are spliced in
 * verbatim; everything else is coerced to string and HTML-escaped.
 *
 * Kept separate from `replaceVariables` so the same policy applies
 * consistently across any future caller (e.g. an STX adapter that
 * delegates back to us for the unsafe-by-default branch).
 */
function renderTemplateValue(value: TemplateVariableValue): string {
  if (value === null || value === undefined) return ''
  if (value instanceof SafeHtml) return value.value
  return escapeHtml(String(value))
}

/**
 * Email template lookup roots, in resolution order: userland
 * `resources/emails/` first, then the framework-shipped defaults in
 * `storage/framework/defaults/resources/emails/`. Ordering is
 * dir-major — ANY userland file (either extension) beats the defaults
 * copy of the same name, so projects can override a shipped .stx
 * template with their own .html one (stacksjs/stacks#1944).
 */
const templateRoots: Array<(relativePath: string) => string> = [
  relativePath => resourcesPath(join('emails', relativePath)),
  relativePath => defaultsResourcesPath(join('emails', relativePath)),
]

/**
 * Resolve a template file path, preferring .stx over .html within
 * each lookup root. Probes userland `resources/emails/` first, then
 * the framework defaults (see {@link templateRoots}).
 * Returns { path, type } where type is 'stx' or 'html'
 */
function resolveTemplatePath(templateName: string): { path: string, type: 'stx' | 'html' } | null {
  for (const root of templateRoots) {
    // If already has extension, use as-is
    if (templateName.endsWith('.stx')) {
      const fullPath = root(templateName)
      if (fs.existsSync(fullPath)) return { path: fullPath, type: 'stx' }
      continue
    }

    if (templateName.endsWith('.html')) {
      const fullPath = root(templateName)
      if (fs.existsSync(fullPath)) return { path: fullPath, type: 'html' }
      continue
    }

    // Bare name: try .stx first, then .html within this root
    const stxPath = root(`${templateName}.stx`)
    if (fs.existsSync(stxPath)) return { path: stxPath, type: 'stx' }

    const htmlPath = root(`${templateName}.html`)
    if (fs.existsSync(htmlPath)) return { path: htmlPath, type: 'html' }
  }

  return null
}

/**
 * Load an HTML template file content. Probes the same roots as
 * {@link resolveTemplatePath} (userland first, then framework
 * defaults) so e.g. `loadLayout('base')` finds the shipped
 * `defaults/resources/emails/layouts/base.html` when userland has no
 * `layouts/` directory (stacksjs/stacks#1944).
 */
function loadHtmlTemplate(templatePath: string): string | null {
  const path = templatePath.endsWith('.html') ? templatePath : `${templatePath}.html`

  for (const root of templateRoots) {
    const fullPath = root(path)
    if (fs.existsSync(fullPath))
      return fs.readFileSync(fullPath, 'utf-8')
  }

  return null
}

/**
 * Load a layout template
 */
function loadLayout(layoutName: string): string | null {
  return loadHtmlTemplate(`layouts/${layoutName}`)
}

/**
 * Convert HTML to plain text
 */
function htmlToText(html: string): string {
  return html
    // Replace <br> and block elements with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<\/td>/gi, '\t')
    // Remove remaining HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, `"`)
    .replace(/&#39;/g, `'`)
    .replace(/&copy;/g, '(c)')
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
}

/**
 * Render an email template with optional layout
 *
 * Supports both .stx and .html templates. When a .stx template
 * is found, it uses the STX engine for rendering (with directives,
 * server scripts, etc.). When an .html template is found, it uses
 * simple {{ variable }} replacement with layout wrapping.
 *
 * Templates resolve from userland `resources/emails/` first, then
 * fall back to the framework-shipped defaults in
 * `storage/framework/defaults/resources/emails/` — so the prebaked
 * mailers (password-reset, password-changed, email-verification)
 * work out of the box on a default install while any userland file
 * with the same name always wins (stacksjs/stacks#1944).
 *
 * Within each directory, .stx templates are preferred over .html
 * when both exist.
 *
 * @example
 * ```typescript
 * // STX template (resources/emails/welcome.stx)
 * const { html, text } = await template('welcome', {
 *   variables: { userName: 'John' }
 * })
 *
 * // HTML template with layout
 * const { html, text } = await template('notification', {
 *   layout: 'base',
 *   variables: { message: 'Hello' }
 * })
 *
 * // Without layout (HTML templates only)
 * const { html, text } = await template('simple', {
 *   layout: false
 * })
 * ```
 */
export async function template(
  templateName: string,
  options: TemplateOptions = {},
): Promise<TemplateResult> {
  const {
    variables = {},
    layout = 'base',
    subject = '',
    inline = shouldInlineByDefault(),
  } = options

  // Merge default variables with provided ones
  const allVariables: TemplateVariables = {
    ...getDefaultVariables(),
    subject,
    ...variables,
  }

  // Resolve template path (prefers .stx over .html)
  const resolved = resolveTemplatePath(templateName)

  if (!resolved) {
    console.warn(`[Email Template] Template "${templateName}" not found`)
    return { html: '', text: '' }
  }

  // Use STX engine for .stx templates. `renderEmail` is the public
  // entry point from `@stacksjs/stx` (re-exported through the package
  // root) that handles the full <script server> + props + layout
  // chain. Dynamic import so test runs / CLI scripts that never load
  // an email template pay zero startup cost for the stx graph.
  //
  // `componentsDir` points stx at the bundled `<EmailLayout>` /
  // `<EmailButton>` / etc. component library (stacksjs/stacks#1901)
  // so email templates can drop them in by name. Userland is free
  // to define its own components alongside its templates — stx
  // walks the standard `components/` paths too — but the bundled
  // set is always reachable from this directory.
  if (resolved.type === 'stx') {
    try {
      const { renderEmail } = await import('@stacksjs/stx')
      const result = await renderEmail(resolved.path, allVariables, {
        componentsDir: defaultsResourcesPath('components/Email'),
      })
      // CSS inlining pass (stacksjs/stacks#1902 B2). The bundled
      // <EmailLayout> & co. components are already inline-styled, so
      // this is mostly for userland `<style>` blocks. `inline: false`
      // is honoured for dev preview; `shouldInlineByDefault()`
      // returns true only in production.
      return {
        ...result,
        html: inlineCss(result.html, { inline }),
      }
    }
    catch (error: unknown) {
      log.warn(`[email] STX template rendering failed for ${templateName}: ${error instanceof Error ? error.message : String(error)}`)
      return { html: '', text: '' }
    }
  }

  // HTML template path - use simple variable replacement
  let content = fs.readFileSync(resolved.path, 'utf-8')

  // Replace variables in content
  content = replaceVariables(content, allVariables)

  let html: string

  // Wrap in layout if specified
  if (layout !== false) {
    const layoutHtml = loadLayout(layout)

    if (!layoutHtml) {
      console.warn(`[Email Template] Layout "${layout}" not found, using content only`)
      html = content
    }
    else {
      // Insert content into layout. The inner `content` block has already
      // been through `replaceVariables` (which escaped any caller-controlled
      // variables), so mark it as SafeHtml here — otherwise the next pass
      // would escape the rendered tags back into entities and the layout
      // would render literal `&lt;p&gt;...&lt;/p&gt;` to the user.
      // See stacksjs/stacks#1871 M-1.
      allVariables.content = safe(content)
      html = replaceVariables(layoutHtml, allVariables)
    }
  }
  else {
    html = content
  }

  // CSS inlining pass — same gate as the stx path (stacksjs/stacks#1902).
  html = inlineCss(html, { inline })

  // Generate plain text version
  const text = htmlToText(html)

  return { html, text }
}

/**
 * Render a raw HTML string with variables (no file loading)
 */
export function renderHtml(
  htmlContent: string,
  variables: TemplateVariables = {},
): TemplateResult {
  const allVariables = {
    ...getDefaultVariables(),
    ...variables,
  }

  const html = replaceVariables(htmlContent, allVariables)
  const text = htmlToText(html)

  return { html, text }
}

/**
 * Check if a template exists (.stx or .html)
 */
export function templateExists(templateName: string): boolean {
  return resolveTemplatePath(templateName) !== null
}

/**
 * List available templates (.stx and .html)
 */
export function listTemplates(): string[] {
  const emailsPath = resourcesPath('emails')

  if (!fs.existsSync(emailsPath)) {
    return []
  }

  const templates: string[] = []

  function scanDir(dir: string, prefix: string = '') {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'layouts') {
        scanDir(join(dir, entry.name), `${prefix}${entry.name}/`)
      }
      else if (entry.isFile() && (entry.name.endsWith('.html') || entry.name.endsWith('.stx'))) {
        const name = entry.name.replace(/\.(html|stx)$/, '')
        if (!templates.includes(`${prefix}${name}`)) {
          templates.push(`${prefix}${name}`)
        }
      }
    }
  }

  scanDir(emailsPath)
  return templates
}
