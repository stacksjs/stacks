---
name: stacks-sites
description: Use when resolving multi-site tenants by host, provisioning sites, scoping queries, or authorizing site-owned content. Covers @stacksjs/sites and config/sites.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Multi-site tenancy

The native package resolves hosts and carries a site snapshot through a request.
Host tenancy and an authenticated administrator's team ownership are different
contracts; do not substitute one for the other.

## Resolution and explicit scoping

Use siteResolver with configured resolver/store behavior. normalizeHost,
classifyHost, requestHost and resolveSiteByHost own host parsing and lookup.
currentSite, currentSiteId, requireSite and runWithSite serve API request context.
An unresolved site fails a required-site operation rather than silently selecting
another tenant. Respect platform hosts and configured forwarded-host trust.

forSite(query, column, siteId) adds an explicit predicate. Defining a Site model
does not globally scope every raw query. A site id in an arbitrary request body
is not an authenticated or host-resolved tenant. siteOwnership governs admin
resources using the caller's real team membership; public reads scope by host.

API AsyncLocalStorage is not the snapshot read by every stx server render.
Templates use requestContext.site() through the serving layer's per-request
snapshot. Read stacks-config and stacks-stx before crossing that boundary.

## Provisioning

provisionSite refreshes a supplied tenant's site/branding and creates missing
starter pages while preserving matched existing paths. Verify normalized nested
slugs and parent paths before relying on reprovisioning idempotency for a complex
page hierarchy. Pass actual tenancy and
page input; it does not invent a tenant model or overwrite all CMS content.
Use stacks-cms document APIs for pages and stacks-forms for site-owned forms.

Test two concurrent sites, platform/unresolved hosts, query predicates,
administrator membership, reprovisioning and edited-page preservation.
Source: core/sites/src/{context,resolver,middleware,scoping,provision,snapshot}.ts.
Evidence: sites.test.ts and provision.test.ts.
