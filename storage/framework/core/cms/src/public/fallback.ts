import type { CmsSiteContextLike } from './render'
import { requestHost, resolveSiteByHost, sitesOptions } from '@stacksjs/sites'
import { registerDefaultBlocks } from '../blocks/defaults'
import { resolveRedirect } from '../redirects'
import { renderCmsPage } from './render'
import { normalizePath, resolvePublishedPage } from './resolve'

/**
 * The CMS catch-all for both stx servers' `onRequest`, called AFTER
 * file-routed stx views have had their chance (coded pages win over CMS
 * pages). Returns a Response to serve, or null to fall through to the
 * server's normal 404.
 *
 * Order: published page -> recorded redirect -> null. Only GET/HEAD; only
 * with a resolved site - the platform's own hosts have no CMS tree.
 */
export async function cmsPageFallback(req: Request, site: CmsSiteContextLike | null | undefined): Promise<Response | null> {
  if (!site)
    return null
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return null

  registerDefaultBlocks()

  const url = new URL(req.url)
  const path = normalizePath(url.pathname)

  const page = await resolvePublishedPage(site.id, path)
  if (page)
    return await renderCmsPage(site, page)

  const redirect = await resolveRedirect(site.id, path)
  if (redirect) {
    return new Response(null, {
      status: redirect.statusCode,
      headers: { Location: redirect.toPath + url.search },
    })
  }

  return null
}

/**
 * The one-call version both stx servers use from their `onResponse` hooks
 * when stx-serve produced a 404: coded views win by construction (they never
 * 404), and only then does the CMS tree get a say. Cheap exits first - the
 * asset-extension guard keeps missing .css/.png lookups off the database.
 */
export async function cmsNotFoundFallback(req: Request): Promise<Response | null> {
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return null

  const url = new URL(req.url)
  if (/\.[a-z0-9]{1,8}$/i.test(url.pathname))
    return null

  const options = sitesOptions()
  if (!options.enabled)
    return null

  const site = await resolveSiteByHost(requestHost(req.headers, options), undefined, options)
  return await cmsPageFallback(req, site)
}
