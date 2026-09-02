import type { TsCloudConfig } from './deploy'
import { dnsPublishingAllowed, resolveSshTarget } from './deploy-ssh-target'
import type {
  DeploymentPreview,
  DeploymentPreviewOperation,
  DeploymentPreviewSite,
  DeploymentSiteKind,
} from '@stacksjs/types'

/**
 * The ts-cloud config this command previews.
 *
 * An alias for the one description in `deploy.ts` rather than a second partial
 * copy of it: this file used to declare its own, listing `project.name` and
 * `mode` where the other listed `hetzner` and `sites[].port`, so the two
 * disagreed about the same file and neither was wrong enough to notice.
 */
type DeploymentPreviewConfig = TsCloudConfig

export interface CreateDeploymentPreviewOptions {
  config?: DeploymentPreviewConfig
  environment: string
  site?: string
  domain?: string
  docker?: boolean
  fallbackProjectName?: string
  fallbackProjectSlug?: string
  fallbackProvider?: string
  fallbackMode?: string
  fallbackRegion?: string
  resolveSiteKind: (site: Record<string, unknown>) => DeploymentSiteKind
  applyEnvironmentToSites: (
    sites: Record<string, Record<string, unknown> | null | undefined>,
    environment: string,
    config: DeploymentPreviewConfig,
  ) => Record<string, Record<string, unknown> | null | undefined>
  warnings?: string[]
}

export interface ResolveDeploymentEnvironmentOptions {
  positional?: string
  option?: string
  staging?: boolean
  development?: boolean
}

export function resolveDeploymentEnvironment(options: ResolveDeploymentEnvironmentOptions): string {
  const requested = options.positional
    || options.option
    || (options.staging ? 'staging' : options.development ? 'development' : 'production')
  return requested === 'prod' ? 'production' : requested === 'dev' ? 'development' : requested
}

export function applyDeploymentDomainOverride<T extends DeploymentPreviewConfig>(config: T, domain?: unknown): T {
  if (domain !== undefined && typeof domain !== 'string')
    throw new Error('Domain must be a valid DNS name.')
  const override = domain?.trim().toLowerCase()
  if (!override) return config
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(override))
    throw new Error('Domain must be a valid DNS name.')

  const entries = Object.entries(config.sites || {})
  const primary = entries
    .map(([, site]) => site)
    .find(site => site?.path === '/' && typeof site.start === 'string' && strings(site.domain).length > 0)
    || entries.map(([, site]) => site).find(site => strings(site?.domain).length > 0)
  const current = strings(primary?.domain)[0]?.toLowerCase()
  if (!current || current === override) return config

  const replaceHost = (value: string): string => {
    const normalized = value.toLowerCase()
    if (normalized === current) return override
    if (normalized.endsWith(`.${current}`)) return `${value.slice(0, -current.length)}${override}`
    return value.replace(new RegExp(`(https?://)((?:[a-z0-9-]+\\.)*)${current.replace(/[.]/g, '\\.')}(?=[:/?#]|$)`, 'gi'), (_match, scheme: string, prefix: string) => `${scheme}${prefix}${override}`)
  }

  return {
    ...config,
    sites: Object.fromEntries(entries.map(([name, site]) => {
      if (!site) return [name, site]
      const next = { ...site }
      if (typeof next.domain === 'string') next.domain = replaceHost(next.domain)
      else if (Array.isArray(next.domain)) next.domain = next.domain.map(value => typeof value === 'string' ? replaceHost(value) : value)
      if (typeof next.redirect === 'string') next.redirect = replaceHost(next.redirect)
      else if (next.redirect && typeof next.redirect === 'object' && !Array.isArray(next.redirect)) {
        const redirect = { ...(next.redirect as Record<string, unknown>) }
        if (typeof redirect.to === 'string') redirect.to = replaceHost(redirect.to)
        next.redirect = redirect
      }
      return [name, next]
    })),
  }
}

function strings(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function previewSite(name: string, site: Record<string, unknown>, resolveSiteKind: CreateDeploymentPreviewOptions['resolveSiteKind']): DeploymentPreviewSite {
  const port = typeof site.port === 'number' && Number.isInteger(site.port) ? site.port : null
  return {
    name,
    kind: resolveSiteKind(site),
    domains: strings(site.domain),
    path: typeof site.path === 'string' && site.path ? site.path : '/',
    root: typeof site.root === 'string' && site.root ? site.root : null,
    port,
    build: typeof site.build === 'string' && site.build ? site.build : null,
    preStart: strings(site.preStart),
  }
}

function operation(
  phase: DeploymentPreviewOperation['phase'],
  label: string,
  detail: string,
  sites: string[] = [],
): DeploymentPreviewOperation {
  return { phase, label, detail, sites }
}

export function createDeploymentPreview(options: CreateDeploymentPreviewOptions): DeploymentPreview {
  const config = applyDeploymentDomainOverride(options.config || {}, options.domain)
  const configuredSites = options.applyEnvironmentToSites(config.sites || {}, options.environment, config)
  const availableSites = Object.entries(configuredSites)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[1]))

  if (options.site && !availableSites.some(([name]) => name === options.site)) {
    const available = availableSites.map(([name]) => name).join(', ') || 'none'
    throw new Error(`Site '${options.site}' is not configured. Available sites: ${available}.`)
  }

  const selectedSites = availableSites
    .filter(([name]) => !options.site || name === options.site)
    .map(([name, site]) => previewSite(name, site, options.resolveSiteKind))

  const provider = config.cloud?.provider || options.fallbackProvider || 'aws'
  const mode = config.mode || options.fallbackMode || 'server'
  const attachTo = config.cloud?.attachTo || null
  const projectName = config.project?.name || options.fallbackProjectName || 'Stacks application'
  const projectSlug = config.project?.slug || options.fallbackProjectSlug || 'app'
  const region = config.environments?.[options.environment]?.region
    || config.project?.region
    || options.fallbackRegion
    || 'us-east-1'
  const siteNames = selectedSites.map(site => site.name)
  const shippable = selectedSites.filter(site => site.kind !== 'bucket' && site.kind !== 'redirect')
  const staticSites = shippable.filter(site => site.kind === 'server-static' && site.build)
  const runtimeSites = shippable.filter(site => site.kind === 'server-app' || site.kind === 'server-php')
  const publicSites = selectedSites.filter(site => site.domains.length > 0)
  const operations: DeploymentPreviewOperation[] = [
    operation('validate', 'Validate deployment inputs', `Resolve the ${options.environment} configuration and list the prerequisites checked before a real deployment.`, siteNames),
  ]

  // An ssh host is adopted rather than created: the preview should promise a
  // check and a bootstrap, not a server that will come into existence.
  const sshTarget = provider === 'ssh' ? resolveSshTarget(config) : null
  const publishesDns = dnsPublishingAllowed({
    provider,
    publicIp: sshTarget?.host,
    sites: configuredSites as Record<string, { domain?: string | string[] } | null | undefined>,
  })

  if (provider === 'ssh') {
    const where = sshTarget ? `${sshTarget.user}@${sshTarget.host}${sshTarget.port === 22 ? '' : `:${sshTarget.port}`}` : 'the configured host'
    operations.push(attachTo
      ? operation('infrastructure', 'Use attached server', `Resolve the existing '${attachTo}' server at ${where} and verify that this project owns its gateway fragment and ports.`, siteNames)
      : operation('infrastructure', 'Adopt SSH host', `Check ${where} over SSH (architecture, OS, memory, disk, sudo, clock, outbound HTTPS), then install bun, the rpx gateway and the systemd units if they are missing.`, siteNames))
  }
  else if (provider === 'hetzner') {
    operations.push(attachTo
      ? operation('infrastructure', 'Use attached server', `Resolve the existing '${attachTo}' server and verify that this project owns its gateway fragment and ports.`, siteNames)
      : operation('infrastructure', 'Reconcile compute infrastructure', `Create or reuse the ${config.infrastructure?.compute?.size || 'configured'} Hetzner server, firewall, SSH key, and managed services.`, siteNames))
  }
  else {
    operations.push(operation('infrastructure', 'Reconcile cloud infrastructure', `Generate and apply the ${provider} infrastructure for ${region}.`, siteNames))
  }

  if (staticSites.length > 0) {
    operations.push(operation(
      'build',
      'Build static sites',
      `Run each configured static build: ${staticSites.map(site => `${site.name}: ${site.build}`).join('; ')}.`,
      staticSites.map(site => site.name),
    ))
  }

  if (shippable.length > 0) {
    operations.push(operation(
      'package',
      'Package releases',
      'Create source or static release archives while excluding local dependencies, secrets, databases, caches, logs, and server-owned paths.',
      shippable.map(site => site.name),
    ))
    operations.push(operation(
      'release',
      options.site ? `Ship site '${options.site}'` : 'Ship release',
      options.site
        ? 'Upload and activate only the selected site while preserving every other configured route and service.'
        : 'Upload and atomically activate the selected releases on the target infrastructure.',
      shippable.map(site => site.name),
    ))
  }

  if (runtimeSites.length > 0) {
    const hookCount = runtimeSites.reduce((total, site) => total + site.preStart.length, 0)
    operations.push(operation(
      'runtime',
      'Prepare and restart services',
      `Run ${hookCount} configured pre-start command${hookCount === 1 ? '' : 's'}, update service definitions, and restart application runtimes.`,
      runtimeSites.map(site => site.name),
    ))
  }

  if (publicSites.length > 0) {
    operations.push(operation('gateway', 'Reconcile public routes', publishesDns
      ? 'Regenerate the reverse-proxy routes from the complete environment-aware site model.'
      : 'Regenerate the reverse-proxy routes from the complete environment-aware site model, served over the local network only.', publicSites.map(site => site.name)))

    // A private host publishes nothing and asks for no certificate: neither a
    // public A record nor an ACME challenge can reach it.
    if (publishesDns) {
      operations.push(operation('dns', 'Reconcile DNS records', 'Publish the configured public domains through their resolved DNS providers.', publicSites.map(site => site.name)))
      operations.push(operation('tls', 'Reconcile TLS certificates', 'Issue or renew certificates for public domains and reload the gateway when records change.', publicSites.map(site => site.name)))
    }
  }

  if (options.docker) {
    operations.push(operation('container', 'Build OCI images', 'Build the requested OCI images with Pantry and push them when registry credentials are configured.', shippable.map(site => site.name)))
  }

  return {
    version: 1,
    dryRun: true,
    project: { name: projectName, slug: projectSlug },
    provider,
    mode,
    environment: options.environment,
    region,
    target: {
      site: options.site || null,
      domain: options.domain || null,
      attachTo,
    },
    sites: selectedSites,
    operations,
    warnings: [...(options.warnings || [])],
  }
}

export function formatDeploymentPreview(plan: DeploymentPreview): string {
  const lines = [
    '',
    'Deployment preview',
    'No changes will be made.',
    '',
    `Project: ${plan.project.name} (${plan.project.slug})`,
    `Environment: ${plan.environment}`,
    `Provider: ${plan.provider}`,
    `Mode: ${plan.mode}`,
    `Region: ${plan.region}`,
    `Target: ${plan.target.site || 'all configured sites'}`,
    '',
    'Planned operations:',
    ...plan.operations.map((item, index) => `${index + 1}. ${item.label}\n   ${item.detail}`),
  ]

  if (plan.warnings.length > 0)
    lines.push('', 'Warnings:', ...plan.warnings.map(warning => `- ${warning}`))

  return `${lines.join('\n')}\n`
}

export const deploymentPreviewJsonPrefix = 'STACKS_DEPLOY_PREVIEW_JSON='
