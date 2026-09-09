/**
 * Fathom Analytics Driver
 *
 * Fathom is a hosted, cookie-free analytics product. The integration is a single
 * script tag plus a handful of `data-` attributes:
 *
 * - `data-site`      the site ID from your Fathom dashboard
 * - `data-honor-dnt` respect the browser's Do Not Track setting
 * - `data-spa`       re-record a pageview on client-side navigation
 *
 * `scriptUrl` overrides the default CDN URL, which is what lets an app serve the
 * script from its own origin so a content blocker does not drop it.
 */

import type { AnalyticsHeadTag } from './shared'
import { renderHeadTags } from './shared'

export interface FathomConfig {
  /** Fathom site ID */
  siteId: string
  /** Custom script URL (defaults to Fathom's CDN) */
  scriptUrl?: string
  /** Honor Do Not Track browser setting */
  honorDnt?: boolean
  /** Enable SPA mode for client-side routing */
  spa?: boolean
}

/** Fathom's hosted script, used when `scriptUrl` is not set. */
export const FATHOM_DEFAULT_SCRIPT_URL = 'https://cdn.usefathom.com/script.js'

/**
 * Build the Fathom head tags.
 *
 * Values are raw; escaping happens when the tags are rendered.
 */
export function getFathomAnalyticsHead(config: FathomConfig): AnalyticsHeadTag[] {
  if (!config.siteId)
    return []

  const attrs: Record<string, string> = {
    'src': config.scriptUrl || FATHOM_DEFAULT_SCRIPT_URL,
    'data-site': config.siteId,
    'defer': '',
  }

  if (config.honorDnt)
    attrs['data-honor-dnt'] = 'true'

  // Fathom takes a mode rather than a flag here; "auto" covers both history
  // and hash routing, which is the behaviour `spa: true` describes.
  if (config.spa)
    attrs['data-spa'] = 'auto'

  return [['script', attrs]]
}

/**
 * Generate the Fathom tracking script tag.
 */
export function generateFathomScript(config: FathomConfig): string {
  const tags = getFathomAnalyticsHead(config)

  if (!tags.length)
    return ''

  return `<!-- Stacks Fathom Analytics -->\n${renderHeadTags(tags)}`
}
