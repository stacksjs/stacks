# @stacksjs/sites

Request-level multi-site tenancy: one Stacks app serving many public web
properties, each resolved from the request's Host header.

A host resolves in this order:

1. exact match on a **verified** `site_domains.domain` row (custom domains)
2. `{subdomain}.{config.sites.baseDomain}` matching `sites.subdomain`
3. a configured platform host (the app itself) - no site, never 404'd
4. nothing - null, or 404 when `config.sites.strict` is on

## The two channels

- **API / bun-router:** the `siteResolver` middleware stamps `request.site`
  and the ambient AsyncLocalStorage context (`currentSite()`, `requireSite()`).
- **STX pages:** ALS does not survive into stx-serve's render. The serving
  layer stashes `toSiteSnapshot(site)` on the request-context snapshot, and
  `<script server>` blocks read `requestContext.site()`. Never call
  `currentSite()` from an stx server script.

## Scoping is explicit

There is no automatic global scope, on purpose: generated `Model.where()`
statics offer no interception point, and an implicit ALS scope silently
vanishes in queue workers and CLI runs - exactly where a missing scope becomes
a cross-tenant leak. Instead:

- data-layer functions take `siteId` as a required argument; the route
  boundary resolves it once via `requireSite()`
- `forSite(qb)` scopes a query builder to the ambient site
- `siteOwnership()` plugs into `model.ownership` so admin `useApi` routes are
  restricted to sites the caller's active team owns

Deploy-level tenancy (`cloud.attachTo`) is a different axis: that is many apps
on one box. This is many sites in one app.
