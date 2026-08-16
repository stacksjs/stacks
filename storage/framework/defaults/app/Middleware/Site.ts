import { siteResolver } from '@stacksjs/sites'

/**
 * Site Middleware
 *
 * Resolves the request's site from its Host header (`@stacksjs/sites`) and
 * publishes it as `request.site` plus the ambient `currentSite()` context.
 * A no-op while `config/sites.ts` is disabled. With `sites.strict`, an
 * unknown host answers 404 here.
 *
 * Usage:
 * route.group({ middleware: ['site'] }, () => { ... public tenant routes ... })
 */
export default siteResolver
