import { fs } from '@stacksjs/storage'
import { resourcesPath } from '@stacksjs/path'
import { join } from 'node:path'

interface HtmlResult {
  html: string
  text: string
}

export async function template(path: string, options?: Record<string, any>): Promise<HtmlResult> {
  // Simple template function without @vue-email/compiler (removed WASM dependency)
  // For production binaries, we use plain HTML templates instead of Vue templates
  const templatePath = path.endsWith('.html') ? path : `${path}.html`
  const fullPath = resourcesPath(join('emails', templatePath))

  let html = ''
  if (fs.existsSync(fullPath)) {
    html = fs.readFileSync(fullPath, 'utf-8')

    // Simple template variable replacement if options provided
    if (options) {
      for (const [key, value] of Object.entries(options)) {
        html = html.replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), String(value))
      }
    }
  }

  // Strip HTML tags for plain text version
  const text = html.replace(/<[^>]*>/g, '').trim()

  return { html, text }
}
