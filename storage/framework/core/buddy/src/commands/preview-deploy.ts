/**
 * Preview deployments (stacksjs/stacks#735): a pull request deployed as its
 * own tenant on the app's box, at `<name>.<preview domain>`, and removed when
 * the pull request closes.
 *
 * A preview is a separate project as far as the box is concerned: slug
 * `<app slug>-<name>`, attached (`cloud.attachTo`) to the box the app runs
 * on. That is what isolates it, and it is why nothing here is new machinery:
 *
 *   - its gateway fragment is `/etc/rpx/sites.d/<preview slug>.json`, its
 *     units are `<preview slug>-*`, its tree is `/var/www/<preview slug>-*`,
 *     so writing them can never touch the app's
 *   - a relative SQLite path lands in `/var/www/<preview slug>-shared/`, so
 *     a preview has its own database without anyone configuring one
 *   - its secrets come from `.env.preview` alone, never layered over the
 *     base environment's, so a preview cannot reach production data
 *
 * Removal undoes exactly what the deploy created, by those same names.
 */

/** A preview name: `pr-123`, lowercase, usable in a hostname, a unit name and a slug. */
const PREVIEW_NAME = /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/

export function assertPreviewName(name: string): string {
  if (!PREVIEW_NAME.test(name))
    throw new TypeError(`"${name}" is not a usable preview name: lowercase letters, digits and dashes, at most 30 characters, starting and ending with a letter or digit (e.g. pr-123).`)
  return name
}

export interface PreviewTarget {
  /** The preview's own project slug: `<app slug>-<name>`. */
  slug: string
  /** The project whose box it attaches to. */
  owner: string
  /** The site deployed, by its name in config/cloud.ts. */
  site: string
  host: string
  url: string
}

/**
 * The domain previews live under: `cloud.previews.domain` in
 * config/cloud.ts, else `PREVIEW_DOMAIN`. Its DNS has to be managed by a
 * provider the deploy has credentials for, or each preview's record is
 * created by hand.
 */
export function previewDomain(config: any, env: Record<string, string | undefined>): string {
  const domain = String(config?.cloud?.previews?.domain ?? env.PREVIEW_DOMAIN ?? '').trim().replace(/^\*\./, '').replace(/\.$/, '')
  if (!domain)
    throw new TypeError('Previews need a domain to live under: set cloud.previews.domain in config/cloud.ts, or PREVIEW_DOMAIN.')
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain))
    throw new TypeError(`"${domain}" is not a domain previews can live under.`)
  return domain.toLowerCase()
}

/** The site a preview deploys: `cloud.previews.site`, else the first site that runs a server. */
export function previewSite(config: any): string {
  const sites: Record<string, any> = config?.sites ?? {}
  const named = config?.cloud?.previews?.site
  if (named) {
    if (!sites[named])
      throw new TypeError(`cloud.previews.site names "${named}", which config/cloud.ts does not declare.`)
    return named
  }
  const serverApp = Object.entries(sites).find(([, site]) => site && (site.start || site.port !== undefined) && !site.redirect && !site.bucket)
  if (!serverApp)
    throw new TypeError('No site in config/cloud.ts runs a server, so there is nothing to preview. Name one with cloud.previews.site.')
  return serverApp[0]
}

export function previewTarget(config: any, name: string, domain: string): PreviewTarget {
  assertPreviewName(name)
  const appSlug = config?.project?.slug
  if (!appSlug)
    throw new TypeError('config/cloud.ts declares no project.slug, which a preview\'s slug is made from.')
  const slug = `${appSlug}-${name}`
  if (slug.length > 63)
    throw new TypeError(`The preview slug "${slug}" is longer than 63 characters; use a shorter preview name.`)
  const site = previewSite(config)
  // The preview's units and directories are named `<slug>-<site>`. One of the
  // app's own sites must never share that prefix, or removing the preview
  // would match the app's units.
  for (const appSite of Object.keys(config.sites ?? {})) {
    if (`${appSlug}-${appSite}`.startsWith(`${slug}-`))
      throw new TypeError(`The preview "${name}" would share unit names with the app's site "${appSite}"; pick another preview name.`)
  }
  const host = `${name}.${domain}`
  return {
    slug,
    // A tenant's previews attach to the same box the tenant does.
    owner: config?.cloud?.attachTo ?? appSlug,
    site,
    host,
    url: `https://${host}`,
  }
}

/**
 * The app's config, reshaped into the preview's: its own slug, attached to
 * the app's box, serving only the preview site at the preview host on `port`.
 * The site's env strings that name the app's own host are pointed at the
 * preview's, the way an environment's `domainPrefix` rewrites them.
 */
export function derivePreviewConfig(config: any, target: PreviewTarget, port: number): any {
  const derived = structuredClone(config)
  const site = derived.sites[target.site]
  const appHost: string | undefined = typeof site.domain === 'string' ? site.domain : undefined

  derived.project = { ...derived.project, slug: target.slug }
  delete derived.project.stackName
  derived.cloud = { ...derived.cloud, attachTo: target.owner }
  delete derived.cloud.retiredDomains
  delete derived.cloud.previews
  // Environments rewrite hosts by prefix; a preview names its host outright.
  delete derived.environments

  const env: Record<string, unknown> = { ...site.env }
  if (appHost) {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === 'string')
        env[key] = value.split(`//${appHost}`).join(`//${target.host}`)
    }
  }
  env.APP_URL = target.url

  derived.sites = {
    [target.site]: {
      ...site,
      domain: target.host,
      port,
      env,
      // A preview answers on its one host: no aliases, no www twin, no redirects to it.
      aliases: undefined,
      www: false,
    },
  }
  return derived
}

/**
 * The port a preview runs on: the one it already has when it is being
 * redeployed, else the first free one in the box's range at or above the
 * app site's own.
 */
export function previewPort(owners: ReadonlyMap<number, string>, slug: string, preferred: number, range = { start: 3000, end: 3999 }): number {
  for (const [port, owner] of owners) {
    if (owner === slug)
      return port
  }
  for (let candidate = Math.max(preferred, range.start); candidate <= range.end; candidate++) {
    if (!owners.has(candidate))
      return candidate
  }
  throw new Error(`No free port between ${range.start} and ${range.end} on the box for a preview.`)
}

/**
 * Remove a preview from the box: stop and delete its units, its gateway
 * fragment and certificate units, and its files, then reload the gateway.
 *
 * Every name is exact - `<slug>-<site>` for the units and the site's tree,
 * `<slug>-shared` for its data - never a wildcard on the slug, because
 * preview `pr-1`'s slug is a prefix of preview `pr-1-docs`'s, and a glob on
 * it would take the other preview down too.
 */
export function buildPreviewTeardownScript(slug: string, site: string): string {
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) || !/^[a-z0-9][a-z0-9_-]*$/i.test(site))
    throw new TypeError(`Refusing to build a teardown for "${slug}" / "${site}".`)
  const unit = `${slug}-${site}`
  // ts-cloud's units for one site: the app and its template instances, its
  // liveness probe, its scheduler, and its queue and daemon workers.
  const units = `^${unit}(@[^.]*)?\\.service$|^${unit}-(liveness\\.(service|timer)|scheduler\\.service|(queue|daemon)-.*\\.service)$`
  return [
    'set -eu',
    // Running template instances (`<unit>@<release>.service`) have no file of
    // their own under /etc/systemd/system, only wants links, so they are asked
    // for by name. `@` straight after the exact unit name: no other preview's
    // unit can match.
    `for instance in $(systemctl list-units --all --plain --no-legend '${unit}@*.service' 2>/dev/null | awk '{print $1}'); do`,
    '  systemctl disable --now "$instance" 2>/dev/null || true',
    'done',
    `rm -f /etc/systemd/system/*.wants/${unit}@*.service`,
    // Another preview whose slug extends this one (`pr-1-docs` beside `pr-1`)
    // still has its fragment, and none of its units are this preview's.
    `others=$(ls /etc/rpx/sites.d/ 2>/dev/null | sed -n 's/^\\(${slug}-.*\\)\\.json$/\\1/p')`,
    `for unit in $(ls /etc/systemd/system/ 2>/dev/null | grep -E '${units}' || true); do`,
    '  skip=0',
    '  for other in $others; do case "$unit" in "$other"-*) skip=1 ;; esac; done',
    '  [ "$skip" = 1 ] && continue',
    '  systemctl disable --now "$unit" 2>/dev/null || true',
    '  rm -rf "/etc/systemd/system/$unit"',
    'done',
    `systemctl disable --now rpx-cert-renew-${slug}.timer 2>/dev/null || true`,
    `rm -f /etc/systemd/system/rpx-cert-renew-${slug}.timer /etc/systemd/system/rpx-cert-renew-${slug}.service /etc/rpx/renew-certs-${slug}.sh /etc/rpx/sites.d/${slug}.json`,
    'systemctl daemon-reload',
    'systemctl reload rpx-gateway.service 2>/dev/null || systemctl restart rpx-gateway.service 2>/dev/null || true',
    `rm -rf /var/www/${unit} /var/www/${slug}-shared /usr/local/sbin/${unit}-liveness`,
    `echo "removed ${slug}"`,
  ].join('\n')
}
