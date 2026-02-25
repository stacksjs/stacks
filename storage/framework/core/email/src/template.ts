import { config } from '@stacksjs/config'
import { fs } from '@stacksjs/storage'
import { resourcesPath } from '@stacksjs/path'
import { join } from 'node:path'

interface TemplateResult {
  html: string
  text: string
}

interface TemplateOptions {
  /** Template variables to replace */
  variables?: Record<string, any>
  /** Layout to wrap the template in (default: 'base', ignored for .stx templates) */
  layout?: string | false
  /** Subject line for the email */
  subject?: string
}

/**
 * Get default template variables from config
 */
function getDefaultVariables(): Record<string, any> {
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
 * Replace template variables in HTML
 */
function replaceVariables(html: string, variables: Record<string, any>): string {
  let result = html

  for (const [key, value] of Object.entries(variables)) {
    // Replace {{ variable }} syntax (with optional whitespace)
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    result = result.replace(regex, String(value ?? ''))
  }

  return result
}

/**
 * Resolve a template file path, preferring .stx over .html
 * Returns { path, type } where type is 'stx' or 'html'
 */
function resolveTemplatePath(templateName: string): { path: string, type: 'stx' | 'html' } | null {
  // If already has extension, use as-is
  if (templateName.endsWith('.stx')) {
    const fullPath = resourcesPath(join('emails', templateName))
    if (fs.existsSync(fullPath)) return { path: fullPath, type: 'stx' }
    return null
  }

  if (templateName.endsWith('.html')) {
    const fullPath = resourcesPath(join('emails', templateName))
    if (fs.existsSync(fullPath)) return { path: fullPath, type: 'html' }
    return null
  }

  // Try .stx first, then .html
  const stxPath = resourcesPath(join('emails', `${templateName}.stx`))
  if (fs.existsSync(stxPath)) return { path: stxPath, type: 'stx' }

  const htmlPath = resourcesPath(join('emails', `${templateName}.html`))
  if (fs.existsSync(htmlPath)) return { path: htmlPath, type: 'html' }

  return null
}

/**
 * Load an HTML template file content
 */
function loadHtmlTemplate(templatePath: string): string | null {
  const path = templatePath.endsWith('.html') ? templatePath : `${templatePath}.html`
  const fullPath = resourcesPath(join('emails', path))

  if (fs.existsSync(fullPath)) {
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
 * .stx templates are preferred over .html when both exist.
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
  } = options

  // Merge default variables with provided ones
  const allVariables: Record<string, any> = {
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

  // Use STX engine for .stx templates
  if (resolved.type === 'stx') {
    try {
      const { renderEmail } = await import('stx')
      const result = await renderEmail(resolved.path, allVariables)
      return result
    }
    catch (error: any) {
      console.error(`[Email Template] STX render error for "${templateName}":`, error.message)
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
      // Insert content into layout
      allVariables.content = content
      html = replaceVariables(layoutHtml, allVariables)
    }
  }
  else {
    html = content
  }

  // Generate plain text version
  const text = htmlToText(html)

  return { html, text }
}

/**
 * Render a raw HTML string with variables (no file loading)
 */
export function renderHtml(
  htmlContent: string,
  variables: Record<string, any> = {},
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
