/**
 * Google Analytics Driver (GA4)
 *
 * GA4 is two tags: the gtag.js loader, and an inline bootstrap that pushes the
 * initial `js` and `config` commands onto the data layer. `debug: true` sets
 * `debug_mode`, which is what surfaces the property in DebugView.
 */

import type { AnalyticsHeadTag } from './shared'
import { jsString, renderHeadTags } from './shared'

export interface GoogleAnalyticsConfig {
  /** GA4 Measurement ID (e.g., G-XXXXXXXXXX) */
  trackingId: string
  /** Enable debug mode */
  debug?: boolean
}

/** The gtag.js loader, used to build the tag `src`. */
export const GOOGLE_ANALYTICS_SCRIPT_URL = 'https://www.googletagmanager.com/gtag/js'

/**
 * Build the Google Analytics head tags.
 *
 * Values are raw; escaping happens when the tags are rendered.
 */
export function getGoogleAnalyticsHead(config: GoogleAnalyticsConfig): AnalyticsHeadTag[] {
  if (!config.trackingId)
    return []

  const id = jsString(config.trackingId)
  const options = config.debug ? `,{debug_mode:true}` : ''

  return [
    ['script', {
      src: `${GOOGLE_ANALYTICS_SCRIPT_URL}?id=${encodeURIComponent(config.trackingId)}`,
      async: '',
    }],
    ['script', {
      innerHTML: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${id}${options});`,
    }],
  ]
}

/**
 * Generate the Google Analytics tracking script tags.
 */
export function generateGoogleAnalyticsScript(config: GoogleAnalyticsConfig): string {
  const tags = getGoogleAnalyticsHead(config)

  if (!tags.length)
    return ''

  return `<!-- Stacks Google Analytics -->\n${renderHeadTags(tags)}`
}
