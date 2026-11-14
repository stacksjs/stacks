import { lstatSync } from 'node:fs'
import { join } from 'node:path'
import { resolveSiteKind } from '@stacksjs/ts-cloud/deploy'

/**
 * Preview deployments use a separate project slug and the ordinary attach
 * pipeline. The bounded preflight rejects known unsafe inherited settings
 * before discovery/deployment effects. Separate release paths alone do not
 * establish credential provenance or isolate arbitrary trusted app code.
 * Removal retains its existing exact-name behavior.
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

/** Legacy target selection, retained for removal of existing previews. */
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
  return createPreviewTarget(config, name, domain)
}

function createPreviewTarget(config: any, name: string, domain: string, selectedSite?: string): PreviewTarget {
  assertPreviewName(name)
  const appSlug = config?.project?.slug
  if (!appSlug)
    throw new TypeError('config/cloud.ts declares no project.slug, which a preview\'s slug is made from.')
  const slug = `${appSlug}-${name}`
  if (slug.length > 63)
    throw new TypeError(`The preview slug "${slug}" is longer than 63 characters; use a shorter preview name.`)
  const site = selectedSite ?? previewSite(config)
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

export interface PreviewPreflightContext {
  /** Checked without importing/executing application hooks. */
  hasDeployHooks?: boolean
  /** The ordinary native mail tenant provisioner would be enabled. */
  hasMailProvisioning?: boolean
  /** Read-only inspection found a symlink in a configured source/state path. */
  hasSymlinkPaths?: boolean
  /** The page runtime would require a separately served API. */
  requiresApiRuntime?: boolean
}

/** Relative local paths only; no drive, URI, home prefix or traversal. */
export function isPreviewRelativePath(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
    && !/^(?:[\\/~]|[a-z]:|[a-z][a-z0-9+.-]*:)/i.test(value.trim()) && !value.includes('\\')
    && !value.split('/').includes('..') && !/[\0\r\n]/.test(value)
}

/** Read-only: even a dangling symlink is not a preview-owned relative path. */
export function previewHasSymlinkPaths(config: any, projectRoot: string): boolean {
  const paths = ['storage/logs', 'storage/app', config?.stateDir]
  for (const site of Object.values(config?.sites ?? {}) as any[]) {
    if (!site) continue
    const root = isPreviewRelativePath(site.root) ? site.root : '.'
    paths.push(root, join(root, 'database/stacks.sqlite'))
    for (const entry of Array.isArray(site.sharedPaths) ? site.sharedPaths : []) {
      const path = typeof entry === 'string' ? entry : entry?.path
      if (isPreviewRelativePath(path)) paths.push(join(root, path))
    }
    for (const [key, value] of Object.entries(site.env ?? {})) {
      if (/(?:_ROOT|_PATH|_DIR)$/.test(key) || key === 'DB_DATABASE') {
        if (isPreviewRelativePath(value)) paths.push(join(root, value))
      }
    }
  }
  for (const path of paths) {
    if (!isPreviewRelativePath(path)) continue
    let current = projectRoot
    for (const part of path.split('/').filter(part => part && part !== '.')) {
      current = join(current, part)
      try {
        if (lstatSync(current).isSymbolicLink()) return true
      }
      catch (error: any) {
        if (error.code === 'ENOENT') break
        // An unreadable component cannot establish a safe source path.
        return true
      }
    }
  }
  return false
}

/**
 * Known unsupported inherited state, checked against FINAL merged site env.
 * Messages are constants: never return config values, credentials or commands.
 * A conservative configuration guard for trusted apps, not an env provenance
 * guarantee or a sandbox for arbitrary application code/hardcoded adapters.
 */
function previewPreflight(config: any, context: PreviewPreflightContext = {}): { problems: string[], site: string | undefined } {
  const problems = new Set<string>()
  const refuse = (message: string): void => { problems.add(message) }
  const present = (value: unknown): boolean => value !== undefined && value !== null && value !== '' && value !== false
  const configured = (value: unknown): boolean => present(value) && (!Array.isArray(value) || value.length > 0) && (typeof value !== 'object' || Object.keys(value as object).length > 0)
  const entries = Object.entries(config?.sites ?? {}) as [string, any][]
  const sites = entries.map(([, site]) => site)
  const runtimes = entries.filter(([, site]) => site && resolveSiteKind(site) === 'server-app')
  // Resolve once from native kinds, then carry this exact validated identity
  // into the target. The legacy removal selector must not choose deployment.
  const site = config?.cloud?.previews?.site || (runtimes.length === 1 ? runtimes[0]?.[0] : undefined)
  if (sites.some(site => site && resolveSiteKind(site) === 'server-php'))
    refuse('Other native server runtimes require an explicit isolation planner; only a self-contained server app is supported.')
  if (sites.some(site => site && resolveSiteKind(site) === 'proxy'))
    refuse('Proxy upstreams are unsupported for previews; the preview must ship its own server runtime.')
  if (runtimes.length !== 1)
    refuse('Only a single self-contained server runtime can be previewed; multi-runtime selection requires an explicit isolation planner.')
  if (!runtimes.some(([name]) => name === site))
    refuse('The selected preview site must be the self-contained server runtime.')
  const infra = config?.infrastructure ?? {}
  const compute = infra.compute ?? {}
  if (present(infra.appDatabase) || present(compute.database) || present(infra.database))
    refuse('Managed database provisioning is unsupported for previews; inherited database and login identities must never be reused.')
  if (Object.entries(infra).some(([key, value]) => key !== 'compute' && configured(value)))
    refuse('Inherited provider resources are unsupported for previews.')
  if (['services', 'managedServices', 'volumes', 'backups', 'storage', 'dataDisk', 'servicesServer', 'deploymentStorage'].some(key => configured(compute[key])) || configured(config?.objectStorage))
    refuse('Inherited services, storage, volumes or backup policies are unsupported for previews.')
  if (configured(compute.proxy?.cdn))
    refuse('Inherited CDN policies are unsupported for previews; CDN hosts and zone settings require an explicit ownership policy.')
  if (context.hasDeployHooks || configured(config?.hooks) || configured(config?.notifications))
    refuse('Custom deployment hooks are unsupported for previews.')
  if (context.hasMailProvisioning)
    refuse('Inherited mail provisioning is unsupported for previews; shared mail tenants, credentials and DNS must never be reconciled.')
  if (context.requiresApiRuntime)
    refuse('API routes require a separately isolated API runtime; single-runtime previews cannot infer that dependency.')
  if (context.hasSymlinkPaths)
    refuse('Symlinked source or state paths are unsupported for previews.')
  if (present(config?.stateDir) && !isPreviewRelativePath(config.stateDir))
    refuse('Preview state paths must remain relative to the project.')

  for (const [, site] of runtimes) {
    if (['preStart', 'deployScript', 'daemons', 'queues', 'scheduler', 'repository', 'build', 'notifications'].some(key => configured(site[key])))
      refuse('Custom build/deploy commands, background workers and site effects are unsupported for previews.')
    if (present(site.root) && !isPreviewRelativePath(site.root))
      refuse('Preview source roots must remain relative to the project.')
    if (present(site.appDir) || present(site.installDir) || present(site.mounts) || present(site.volumes))
      refuse('Custom runtime directories and mounts are unsupported for previews.')
    if (site.sharedPaths !== undefined && (!Array.isArray(site.sharedPaths) || site.sharedPaths.some((entry: any) => !isPreviewRelativePath(typeof entry === 'string' ? entry : entry?.path) || (typeof entry !== 'string' && present(entry?.target)))))
      refuse('Shared preview paths must be relative, without traversal or explicit shared targets.')
    if (configured(site.ssl) || configured(site.redirects))
      refuse('Custom TLS and redirect policies are unsupported for previews.')
    if (typeof site.start !== 'string' || /[;&|`<>\r\n]|\$\(|(?:^|\s)(?:\/|~|[a-z]:|[a-z_]\w*=)|(?:--port|-p)(?:=|\s)/i.test(site.start))
      refuse('Custom shell effects, absolute commands and fixed port arguments are unsupported for previews.')

    const env = site.env ?? {}
    const has = (key: string): boolean => present(env[key])
    if (has('API_URL') || has('PORT_API'))
      refuse('API dependencies are unsupported for single-runtime previews; a production or loopback upstream must never be inherited.')
    if (String(env.DB_CONNECTION ?? 'sqlite').trim().toLowerCase() !== 'sqlite'
      || ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_PORT', 'DATABASE_URL', 'POSTGRES_URL', 'MYSQL_URL', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN', 'DB_READ_HOSTS'].some(has))
      refuse('Only relative local SQLite is supported; external database connections and credentials are unsupported for previews.')
    for (const key of ['DB_DATABASE_PATH', 'DB_DATABASE']) {
      if (has(key) && (!isPreviewRelativePath(env[key]) || (key === 'DB_DATABASE' && !/\.(?:sqlite3?|db)$/i.test(String(env[key])))))
        refuse('SQLite preview database paths must be relative files without traversal.')
    }
    if (Object.keys(env).some(key => /^(?:REDIS_|VALKEY_)/.test(key) && has(key)))
      refuse('Redis-backed state and credentials require an explicit ACL/namespace policy; previews do not support them yet.')
    const drivers: Record<string, string[]> = {
      CACHE_DRIVER: ['memory'], QUEUE_DRIVER: ['sync', 'memory', 'database'], QUEUE_FAILED_DRIVER: ['database'],
      SESSION_DRIVER: ['cookie', 'file', 'memory', 'database'], LOCK_DRIVER: ['memory', 'database', 'file'], RATE_LIMIT_DRIVER: ['memory', 'database'],
      STORAGE_DRIVER: ['local', 'public', 'bun'], FILESYSTEM_DISK: ['local', 'public'], FILESYSTEM_DRIVER: ['local', 'public', 'bun'],
    }
    if (Object.entries(drivers).some(([key, supported]) => has(key) && !supported.includes(String(env[key]).toLowerCase())))
      refuse('The configured state/storage adapter is unsupported for previews; env prefixes alone do not prove isolation.')
    if (Object.keys(env).some(key => /^(?:(?:AWS_)?S3_|R2_|B2_|GCS_|STORAGE_BUCKET|DB_BACKUP_DESTINATION)/.test(key) && has(key)))
      refuse('External writable storage and backup destinations are unsupported for previews.')
    if (Object.keys(env).some(key => /(?:_ROOT|_PATH|_DIR)$/.test(key) && has(key) && !isPreviewRelativePath(env[key])))
      refuse('Configured runtime/state paths must be relative without traversal.')
    if (has('TS_CLOUD_STATE_DIR'))
      refuse('A state-directory environment override is unsupported for previews.')
  }
  return { problems: [...problems], site }
}

export function previewPreflightProblems(config: any, context: PreviewPreflightContext = {}): string[] {
  return previewPreflight(config, context).problems
}

export interface PreviewDeployInput {
  /** Sites must already contain the actual mergeSiteDeployEnv result. */
  config: any
  name: string
  domain: string
  context?: PreviewPreflightContext
}

export interface PreviewDeployEffects {
  /** The real command puts host/provider discovery and port inspection here. */
  discoverPorts: (target: PreviewTarget) => Promise<ReadonlyMap<number, string>>
  /** The real command puts publication hooks and deployOverSsh here. */
  deploy: (config: any, target: PreviewTarget, port: number) => Promise<void>
}

/** The command's effect boundary: no discovery or deployment on refusal. */
export async function runPreviewDeploy(input: PreviewDeployInput, effects: PreviewDeployEffects): Promise<PreviewTarget> {
  const { problems, site } = previewPreflight(input.config, input.context)
  if (problems.length || !site)
    throw new TypeError(`Preview preflight refused: ${problems.join(' ')}`)
  const target = createPreviewTarget(input.config, input.name, input.domain, site)
  const owners = await effects.discoverPorts(target)
  const port = previewPort(owners, target.slug, Number(input.config.sites?.[target.site]?.port) || 3000)
  await effects.deploy(derivePreviewConfig(input.config, target, port), target, port)
  return target
}
