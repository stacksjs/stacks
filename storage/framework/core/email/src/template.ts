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
  /** Layout to wrap the template in (default: 'base') */
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
 * Load a template file
 */
function loadTemplate(templatePath: string): string | null {
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
  return loadTemplate(`layouts/${layoutName}`)
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
    .replace(/&#39;/g, "'")
    .replace(/&copy;/g, '(c)')
    // Clean up whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim()
}

/**
 * Render an email template with optional layout
 *
 * @example
 * ```typescript
 * // Simple template
 * const { html, text } = await template('welcome', {
 *   variables: { userName: 'John' }
 * })
 *
 * // Without layout
 * const { html, text } = await template('notification', {
 *   layout: false
 * })
 *
 * // Custom layout
 * const { html, text } = await template('invoice', {
 *   layout: 'minimal',
 *   variables: { invoiceId: '12345' }
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

  // Load the content template
  let content = loadTemplate(templateName)

  if (!content) {
    console.warn(`[Email Template] Template "${templateName}" not found`)
    content = ''
  }

  // Replace variables in content
  content = replaceVariables(content, allVariables)

  let html: string

  // Wrap in layout if specified
  if (layout !== false) {
    let layoutHtml = loadLayout(layout)

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
 * Check if a template exists
 */
export function templateExists(templateName: string): boolean {
  return loadTemplate(templateName) !== null
}

/**
 * List available templates
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
      else if (entry.isFile() && entry.name.endsWith('.html')) {
        templates.push(`${prefix}${entry.name.replace('.html', '')}`)
      }
    }
  }

  scanDir(emailsPath)
  return templates
}
