/**
 * Plausible Analytics Driver
 *
 * Plausible is a cookie-free analytics product, hosted or self-hosted. The
 * integration is a single script tag carrying `data-domain`, plus script
 * variants that switch behaviour:
 *
 * - `script.hash.js`  count hash-based routes as pageviews
 * - `script.local.js` do not drop pageviews from localhost / file://
 *
 * `scriptUrl` overrides the computed URL entirely, which is how a self-hosted
 * Plausible (or a first-party proxy that survives content blockers) is pointed
 * at. Pick the variant yourself when you set it.
 */

import type { AnalyticsHeadTag } from './shared'
import { renderHeadTags } from './shared'

export interface PlausibleConfig {
  /** Your domain (e.g., example.com) */
  domain: string
  /** Custom script URL (for self-hosted Plausible or a first-party proxy) */
  scriptUrl?: string
  /** Track localhost during development */
  trackLocalhost?: boolean
  /** Enable hash-based routing */
  hashMode?: boolean
}

/** Plausible's hosted script host, used when `scriptUrl` is not set. */
export const PLAUSIBLE_DEFAULT_HOST = 'https://plausible.io'

/**
 * Build the URL of the hosted script variant matching the config.
 */
export function plausibleScriptUrl(config: PlausibleConfig): string {
  if (config.scriptUrl)
    return config.scriptUrl

  const extensions = [
    config.hashMode ? 'hash' : '',
    config.trackLocalhost ? 'local' : '',
  ].filter(Boolean)

  return `${PLAUSIBLE_DEFAULT_HOST}/js/script${extensions.map(e => `.${e}`).join('')}.js`
}

/**
 * Build the Plausible head tags.
 *
 * Values are raw; escaping happens when the tags are rendered.
 */
export function getPlausibleAnalyticsHead(config: PlausibleConfig): AnalyticsHeadTag[] {
  if (!config.domain)
    return []

  return [
    ['script', {
      'src': plausibleScriptUrl(config),
      'data-domain': config.domain,
      'defer': '',
    }],
  ]
}

/**
 * Generate the Plausible tracking script tag.
 */
export function generatePlausibleScript(config: PlausibleConfig): string {
  const tags = getPlausibleAnalyticsHead(config)

  if (!tags.length)
    return ''

  return `<!-- Stacks Plausible Analytics -->\n${renderHeadTags(tags)}`
}
