import { describe, expect, it } from 'bun:test'
import type { DeploymentSiteKind } from '@stacksjs/types'
import { applyDeploymentDomainOverride, createDeploymentPreview, deploymentPreviewJsonPrefix, formatDeploymentPreview, resolveDeploymentEnvironment } from '../src/commands/deploy-preview'

function resolveSiteKind(site: Record<string, unknown>): DeploymentSiteKind {
  if (site.redirect) return 'redirect'
  if (site.start) return 'server-app'
  if (site.root) return 'server-static'
  return 'bucket'
}

function applyEnvironmentToSites(
  sites: Record<string, Record<string, unknown> | null | undefined>,
  environment: string,
): Record<string, Record<string, unknown> | null | undefined> {
  if (environment === 'production') return sites
  return Object.fromEntries(Object.entries(sites).map(([name, site]) => [
    name,
    site?.domain ? { ...site, domain: `staging.${site.domain}` } : site,
  ]))
}

describe('deployment preview', () => {
  const config = {
    project: { name: 'Acme', slug: 'acme', region: 'us-west-2' },
    cloud: { provider: 'hetzner' },
    mode: 'server',
    infrastructure: { compute: { size: 'medium' } },
    sites: {
      app: {
        domain: 'acme.test',
        root: '.',
        start: 'bun serve.ts',
        port: 3000,
        preStart: ['bun install', 'buddy migrate'],
      },
      docs: {
        domain: 'docs.acme.test',
        root: 'dist/docs',
        build: 'buddy build docs',
      },
      www: {
        domain: 'www.acme.test',
        redirect: 'https://acme.test',
      },
    },
  }

  it('honors global and shorthand deployment environments', () => {
    expect(resolveDeploymentEnvironment({ option: 'staging' })).toBe('staging')
    expect(resolveDeploymentEnvironment({ positional: 'dev', option: 'staging' })).toBe('development')
    expect(resolveDeploymentEnvironment({ positional: 'prod' })).toBe('production')
    expect(resolveDeploymentEnvironment({ development: true })).toBe('development')
    expect(resolveDeploymentEnvironment({ staging: true })).toBe('staging')
    expect(resolveDeploymentEnvironment({})).toBe('production')
  })

  it('applies an explicit base domain across the real ts-cloud site model', () => {
    const overridden = applyDeploymentDomainOverride(config, 'example.com')

    expect(overridden.sites?.app?.domain).toBe('example.com')
    expect(overridden.sites?.docs?.domain).toBe('docs.example.com')
    expect(overridden.sites?.www?.domain).toBe('www.example.com')
    expect(overridden.sites?.www?.redirect).toBe('https://example.com')
    expect(config.sites.app.domain).toBe('acme.test')
    expect(() => applyDeploymentDomainOverride(config, true)).toThrow('Domain must be a valid DNS name.')
  })

  it('builds an ordered environment-aware plan from the deploy model', () => {
    const plan = createDeploymentPreview({
      config,
      environment: 'staging',
      resolveSiteKind,
      applyEnvironmentToSites,
    })

    expect(plan.dryRun).toBe(true)
    expect(plan.provider).toBe('hetzner')
    expect(plan.sites).toHaveLength(3)
    expect(plan.sites[0]?.domains).toEqual(['staging.acme.test'])
    expect(plan.operations.map(operation => operation.phase)).toEqual([
      'validate',
      'infrastructure',
      'build',
      'package',
      'release',
      'runtime',
      'gateway',
      'dns',
      'tls',
    ])
    expect(plan.operations.find(operation => operation.phase === 'runtime')?.detail).toContain('2 configured pre-start commands')
  })

  it('narrows every site-scoped operation without dropping target context', () => {
    const plan = createDeploymentPreview({
      config,
      environment: 'production',
      site: 'docs',
      docker: true,
      resolveSiteKind,
      applyEnvironmentToSites,
    })

    expect(plan.target.site).toBe('docs')
    expect(plan.sites.map(site => site.name)).toEqual(['docs'])
    expect(plan.operations.find(operation => operation.phase === 'release')?.label).toBe("Ship site 'docs'")
    expect(plan.operations.at(-1)?.phase).toBe('container')
  })

  it('rejects an unknown site before any deployment work can begin', () => {
    expect(() => createDeploymentPreview({
      config,
      environment: 'production',
      site: 'missing',
      resolveSiteKind,
      applyEnvironmentToSites,
    })).toThrow("Site 'missing' is not configured")
  })

  it('formats human and machine-readable preview contracts', () => {
    const plan = createDeploymentPreview({
      config,
      environment: 'production',
      resolveSiteKind,
      applyEnvironmentToSites,
      warnings: ['Production data is not backed up.'],
    })
    const human = formatDeploymentPreview(plan)

    expect(human).toContain('No changes will be made.')
    expect(human).toContain('Planned operations:')
    expect(human).toContain('Production data is not backed up.')
    expect(`${deploymentPreviewJsonPrefix}${JSON.stringify(plan)}`).toStartWith('STACKS_DEPLOY_PREVIEW_JSON={')
  })

  it('exits the CLI before every mutating deployment boundary', async () => {
    const source = await Bun.file(new URL('../src/commands/deploy.ts', import.meta.url)).text()
    const start = source.indexOf('if (askedForDryRun)')
    const end = source.indexOf('// Resolved BEFORE the prerequisites', start)
    const previewBranch = source.slice(start, end)

    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(previewBranch).not.toContain('ensureDeployPrerequisites')
    expect(previewBranch).not.toContain('deployToHetzner')
    expect(previewBranch).not.toContain('runAction(')
    expect(previewBranch).not.toContain('writeFileSync')
    expect(previewBranch).not.toContain('execSync')
    expect(source).toContain(".option('--domain <domain>'")
    expect(source).toContain(".option('--prod', descriptions.production, { default: false })")
  })
})

/**
 * What the preview promises for a host nobody provisioned.
 *
 * The preview is the only place a user sees what a deploy intends before it
 * happens, so for an SSH target it has to say "adopt" rather than "create", and
 * it must not promise DNS records or certificates for a board on a home LAN
 * that can never receive either.
 */
describe('deployment preview for an ssh host', () => {
  const base = {
    project: { name: 'Acme', slug: 'acme', region: 'us-west-2' },
    cloud: { provider: 'ssh' },
    mode: 'server',
    sites: {
      app: { domain: 'acme.test', root: '.', start: 'bun serve.ts', port: 3000, preStart: [] },
    },
  }

  const build = (config: Record<string, unknown>) => createDeploymentPreview({
    config: config as any,
    environment: 'production',
    resolveSiteKind,
    applyEnvironmentToSites,
  })

  const lan = { ...base, ssh: { hosts: [{ host: 'pi-stacks.local', user: 'pi' }], profile: 'raspberry-pi' } }
  const routable = { ...base, ssh: { hosts: [{ host: '203.0.113.9', user: 'deploy' }] } }

  it('adopts the named host instead of creating a server', () => {
    const infra = build(lan).operations.find(op => op.phase === 'infrastructure')
    expect(infra?.label).toBe('Adopt SSH host')
    expect(infra?.detail).toContain('pi@pi-stacks.local')
    expect(infra?.detail).toContain('sudo')
  })

  it('promises no DNS or TLS work for a host on the local network', () => {
    const kinds = build(lan).operations.map(op => op.phase)
    expect(kinds).toContain('gateway')
    expect(kinds).not.toContain('dns')
    expect(kinds).not.toContain('tls')
  })

  it('says the routes are local-network only', () => {
    expect(build(lan).operations.find(op => op.phase === 'gateway')?.detail).toContain('local network')
  })

  it('still promises DNS and TLS when the host is actually reachable', () => {
    const kinds = build(routable).operations.map(op => op.phase)
    expect(kinds).toContain('dns')
    expect(kinds).toContain('tls')
  })

  it('names the port when the host does not use the default', () => {
    const config = { ...base, ssh: { hosts: [{ host: 'pi.local', user: 'pi', port: 2222 }] } }
    expect(build(config).operations.find(op => op.phase === 'infrastructure')?.detail).toContain('pi@pi.local:2222')
  })

  it('leaves the hetzner preview exactly as it was', () => {
    const kinds = build({ ...base, cloud: { provider: 'hetzner' }, infrastructure: { compute: { size: 'medium' } } }).operations.map(op => op.phase)
    expect(kinds).toContain('dns')
    expect(kinds).toContain('tls')
  })
})
