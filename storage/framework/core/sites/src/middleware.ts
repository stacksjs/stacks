import { Middleware } from '@stacksjs/router'
import { setCurrentSite, SiteNotResolvedError } from './context'
import { isPlatformHost, requestHost, resolveSiteByHost, sitesOptions } from './resolver'

/**
 * Resolve the request's site from its Host header and publish it two ways:
 * as `request.site` for handlers that hold the request, and as the ambient
 * ALS context for model/query code downstream (`currentSite()`).
 *
 * Register under the `site` alias in `app/Middleware.ts` and attach to the
 * route groups that serve tenant traffic. With `config.sites.strict`, an
 * unknown host 404s here; platform hosts always pass with a null site.
 */
export default new Middleware({
  name: 'SiteResolver',
  priority: 1,

  async handle(request: any) {
    const options = sitesOptions()
    if (!options.enabled) {
      setCurrentSite(null)
      return
    }

    const headers: Headers = request.headers instanceof Headers
      ? request.headers
      : new Headers(request.headers ?? {})

    const host = requestHost(headers, options)
    const site = await resolveSiteByHost(host, undefined, options)

    request.site = site
    setCurrentSite(site)

    if (!site && options.strict && !isPlatformHost(host, options))
      throw new SiteNotResolvedError()
  },
})
