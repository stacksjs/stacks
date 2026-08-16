/**
 * First-party server-side pageview capture.
 *
 * The stx servers see every page GET; when `config.analytics.capturePageviews`
 * is on, each qualifying request becomes an `analytics_events` row
 * (name `pageview`, category `web`) - the data source the native
 * /analytics/pages, /referrers and /devices dashboards were built for but
 * never had. No script, no cookies, no fingerprinting: path, referrer host,
 * and a coarse device/browser classification from the user agent.
 */

import { db, sqlDateTime } from '@stacksjs/database'

const ASSET_EXT = /\.(?:css|js|mjs|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|eot|txt|xml|json|webmanifest|mp[34]|webm|pdf|zip)$/i

/** Should this request count as a pageview? Pure, testable. */
export function isPageviewRequest(method: string, pathname: string, headers: Headers): boolean {
  if (method !== 'GET')
    return false
  if (ASSET_EXT.test(pathname))
    return false
  if (pathname.startsWith('/api/') || pathname.startsWith('/__') || pathname.startsWith('/_'))
    return false

  // Browsers navigating send Accept: text/html; fetch()/monitors mostly don't.
  const accept = headers.get('accept') ?? ''
  if (accept && !accept.includes('text/html') && !accept.includes('*/*'))
    return false

  const agent = (headers.get('user-agent') ?? '').toLowerCase()
  if (!agent)
    return false
  if (/bot|crawler|spider|preview|monitor|curl|wget|python-requests|headless/.test(agent))
    return false

  return true
}

/** Coarse classification - enough for the devices/browsers dashboards, nothing identifying. */
export function classifyAgent(userAgent: string): { device: string, browser: string } {
  const agent = userAgent.toLowerCase()

  const device = /ipad|tablet/.test(agent)
    ? 'tablet'
    : /mobi|iphone|android/.test(agent)
      ? 'mobile'
      : 'desktop'

  const browser = agent.includes('edg/')
    ? 'edge'
    : agent.includes('opr/') || agent.includes('opera')
      ? 'opera'
      : agent.includes('firefox/')
        ? 'firefox'
        : agent.includes('chrome/') || agent.includes('crios/')
          ? 'chrome'
          : agent.includes('safari/')
            ? 'safari'
            : 'other'

  return { device, browser }
}

/** The referrer's host, or null for direct/self traffic. */
export function referrerHost(referrer: string | null, ownHost: string): string | null {
  if (!referrer)
    return null
  try {
    const host = new URL(referrer).host.toLowerCase()
    return host && host !== ownHost.toLowerCase() ? host : null
  }
  catch {
    return null
  }
}

/**
 * Record one pageview. Fire-and-forget from the serving hot path - callers
 * do `void recordPageview(...)`; a failed insert loses one statistic, never
 * a page render.
 */
export async function recordPageview(req: Request): Promise<void> {
  try {
    const url = new URL(req.url)
    if (!isPageviewRequest(req.method, url.pathname, req.headers))
      return

    const agent = req.headers.get('user-agent') ?? ''
    const { device, browser } = classifyAgent(agent)
    const now = sqlDateTime(new Date())

    await db
      .insertInto('analytics_events')
      .values({
        name: 'pageview',
        category: 'web',
        path: url.pathname,
        properties: JSON.stringify({
          host: req.headers.get('x-forwarded-host')?.split(',')[0]?.trim() || url.host,
          referrer: referrerHost(req.headers.get('referer'), url.host),
          device,
          browser,
        }),
        created_at: now,
        updated_at: now,
      } as never)
      .execute()
  }
  catch {
    // Analytics must never take a page down.
  }
}
