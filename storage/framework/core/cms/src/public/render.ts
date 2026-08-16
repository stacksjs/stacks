import type { PageBlock } from '../blocks/types'
import type { PublishedPage } from './resolve'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { getBlock } from '../blocks/registry'
import { sanitizeRichText } from './sanitize'

export interface CmsSiteContextLike {
  id: number
  name?: string
  subdomain?: string
  settings?: Record<string, unknown>
}

let renderTemplateFn: typeof import('@stacksjs/stx').renderTemplate | null = null
async function getRenderTemplate(): Promise<typeof import('@stacksjs/stx').renderTemplate> {
  if (!renderTemplateFn) {
    const mod = await import('@stacksjs/stx')
    renderTemplateFn = mod.renderTemplate
  }
  return renderTemplateFn
}

/**
 * Where a template resolves from: the app's views first (the usual
 * app-dir-wins override), then the framework defaults.
 */
function resolveViewFile(relative: string): string | null {
  const candidates = [
    join(process.cwd(), 'resources/views', relative),
    join(process.cwd(), 'storage/framework/defaults/resources/views', relative),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate))
      return candidate
  }
  return null
}

/**
 * Render one block through its stx partial. A block whose type is no longer
 * registered, or whose partial is missing, renders as nothing - a stored
 * document must never 500 a public page because the vocabulary moved on.
 */
async function renderBlock(block: PageBlock, site: CmsSiteContextLike): Promise<string> {
  const definition = getBlock(block.type)
  if (!definition)
    return ''

  const partial = resolveViewFile(`${definition.component}.stx`)
  if (!partial)
    return ''

  const props = { ...block.props }
  // The rich-text vocabulary sanitizes at render, by contract with its schema.
  if (typeof props.html === 'string')
    props.html = sanitizeRichText(props.html)
  if (Array.isArray(props.columns)) {
    props.columns = props.columns.map(column =>
      column && typeof column === 'object' && typeof (column as { html?: unknown }).html === 'string'
        ? { ...column as object, html: sanitizeRichText((column as { html: string }).html) }
        : column)
  }

  const renderTemplate = await getRenderTemplate()
  try {
    return await renderTemplate(partial, {
      context: { block: { id: block.id, type: block.type }, props, site },
      templateOnly: true,
      processClientScripts: false,
      injectCSS: false,
    })
  }
  catch (error) {
    // One broken block loses itself, not the page.
    console.error(`[cms] block "${block.type}" failed to render: ${(error as Error).message}`)
    return ''
  }
}

/**
 * Render a published page to a full HTML response. The page template
 * (`cms/page.stx`, app-overridable) receives the pre-rendered block HTML as
 * `content` plus `page`/`site` for the head and chrome.
 */
export async function renderCmsPage(site: CmsSiteContextLike, page: PublishedPage): Promise<Response> {
  const pieces = await Promise.all(page.blocks.map(block => renderBlock(block, site)))
  const content = pieces.join('\n')

  const template = resolveViewFile('cms/page.stx')
  if (!template) {
    // No template shipped or overridden - serve the bare content so the page
    // still exists; the default template ships with the framework, so this
    // is a broken install, not a normal path.
    return new Response(`<!DOCTYPE html><html><head><title>${escapeHtml(page.title)}</title></head><body>${content}</body></html>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const renderTemplate = await getRenderTemplate()
  const html = await renderTemplate(template, {
    context: {
      site,
      page: {
        id: page.id,
        title: page.title,
        path: page.path,
        template: page.template,
        metaDescription: page.metaDescription ?? '',
      },
      content,
    },
    injectCSS: true,
    title: page.title,
  })

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Short shared cache: pages change rarely, hosts differ per site.
      'Cache-Control': 'public, max-age=60',
      'Vary': 'Host',
    },
  })
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' }[char] as string
  ))
}
