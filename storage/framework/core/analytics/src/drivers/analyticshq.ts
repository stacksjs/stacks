/**
 * AnalyticsHQ Driver
 *
 * AnalyticsHQ (https://analyticshq.org) is the Stacks family's own
 * cookie-free analytics. The integration is one deferred script tag carrying
 * the site id; it beacons pageviews, outbound links, file downloads, Core Web
 * Vitals and custom events back to the host that served it.
 *
 * Custom events need no script from the page: any element carrying
 * `data-analyticshq-event="Name"` sends that event on click, with its other
 * `data-analyticshq-*` attributes as properties.
 *
 * `scriptUrl` points at a self-hosted instance or a verified custom domain.
 */

import type { AnalyticsHeadTag } from './shared'
import { renderHeadTags } from './shared'

export interface AnalyticsHqConfig {
  /** The site id AnalyticsHQ minted (the `data-site` value in its snippet). */
  siteId: string
  /** Custom script URL, for a self-hosted instance or custom domain. */
  scriptUrl?: string
  /**
   * Count visitors who send Do Not Track or Global Privacy Control. They are
   * skipped by default. @default true
   */
  respectDnt?: boolean
  /** Report Core Web Vitals. @default true */
  vitals?: boolean
}

/** The hosted script, used when `scriptUrl` is not set. */
export const ANALYTICSHQ_DEFAULT_SCRIPT = 'https://analyticshq.org/script.js'

/**
 * Build the AnalyticsHQ head tags. Values are raw; escaping happens when the
 * tags are rendered.
 */
export function getAnalyticsHqHead(config: AnalyticsHqConfig): AnalyticsHeadTag[] {
  if (!config.siteId)
    return []

  const attributes: Record<string, string> = {
    'src': config.scriptUrl || ANALYTICSHQ_DEFAULT_SCRIPT,
    'data-site': config.siteId,
    'defer': '',
  }
  // Only the non-default spellings are written, so the tag matches the one the
  // AnalyticsHQ dashboard hands out.
  if (config.respectDnt === false)
    attributes['data-respect-dnt'] = 'false'
  if (config.vitals === false)
    attributes['data-vitals'] = 'false'

  return [['script', attributes]]
}

/**
 * Generate the AnalyticsHQ tracking script tag.
 */
export function generateAnalyticsHqScript(config: AnalyticsHqConfig): string {
  const tags = getAnalyticsHqHead(config)

  if (!tags.length)
    return ''

  return `<!-- Stacks AnalyticsHQ -->\n${renderHeadTags(tags)}`
}
