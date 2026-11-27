import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
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

  it('previews tenant mail and DNS after web TLS on its configured shared server', () => {
    const plan = createDeploymentPreview({
      config,
      environment: 'production',
      mail: { domain: 'acme.test', attachTo: 'stacks' },
      resolveSiteKind,
      applyEnvironmentToSites,
    })

    expect(plan.operations.map(operation => operation.phase).slice(-3)).toEqual(['dns', 'tls', 'mail'])
    const mail = plan.operations.at(-1)
    expect(mail?.detail).toContain('acme.test')
    expect(mail?.detail).toContain("'stacks'")
    expect(mail?.detail).toContain('A record for mail.acme.test')
    expect(mail?.detail).toContain('MX record')
    expect(mail?.detail).toContain('SPF, DKIM, and DMARC TXT records')
    expect(formatDeploymentPreview(plan)).toContain('Reconcile mail tenant')
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

  const build = (config: Record<string, unknown>, holdDns = false, sshPublicIp?: string) => createDeploymentPreview({
    config: config as any,
    environment: 'production',
    holdDns,
    mail: { domain: 'acme.test' },
    sshPublicIp,
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

  it('promises no DNS, TLS, or mail work for a host on the local network', () => {
    const kinds = build(lan).operations.map(op => op.phase)
    expect(kinds).toContain('gateway')
    expect(kinds).not.toContain('dns')
    expect(kinds).not.toContain('tls')
    expect(kinds).not.toContain('mail')
  })

  it('says the routes are local-network only', () => {
    expect(build(lan).operations.find(op => op.phase === 'gateway')?.detail).toContain('local network')
  })

  it('includes DNS, TLS, and mail when the host is publicly reachable', () => {
    const plan = build(routable)
    const kinds = plan.operations.map(op => op.phase)
    expect(kinds).toContain('dns')
    expect(kinds).toContain('tls')
    expect(plan.operations.find(op => op.phase === 'mail')?.detail).toContain('on the deployment server')
  })

  it('uses the pinned SSH address to decide whether the shared server can publish DNS', () => {
    const attachedLan = { ...lan, cloud: { ...lan.cloud, attachTo: 'shared' } }
    const publicPlan = build(attachedLan, false, '203.0.113.9')
    expect(publicPlan.operations.find(op => op.phase === 'infrastructure')?.detail).toContain('pi@203.0.113.9')
    expect(publicPlan.operations.some(op => op.phase === 'mail')).toBe(true)

    const attachedPublic = { ...routable, cloud: { ...routable.cloud, attachTo: 'shared' } }
    const privatePlan = build(attachedPublic, false, '192.168.1.5')
    expect(privatePlan.operations.some(op => op.phase === 'mail')).toBe(false)
  })

  it('names the port when the host does not use the default', () => {
    const config = { ...base, ssh: { hosts: [{ host: 'pi.local', user: 'pi', port: 2222 }] } }
    expect(build(config).operations.find(op => op.phase === 'infrastructure')?.detail).toContain('pi@pi.local:2222')
  })

  it('omits the shared mail operation from the AWS and Fly.io pipelines', () => {
    for (const provider of ['aws', 'fly']) {
      const plan = build({ ...base, cloud: { provider } })
      expect(plan.operations.some(op => op.phase === 'mail')).toBe(false)
    }
  })

  it('includes the mail step for a public Hetzner deployment', () => {
    const kinds = build({ ...base, cloud: { provider: 'hetzner' }, infrastructure: { compute: { size: 'medium' } } }).operations.map(op => op.phase)
    expect(kinds).toContain('dns')
    expect(kinds).toContain('tls')
    expect(kinds).toContain('mail')
  })

  it('keeps the release and gateway while holding publication on Hetzner and SSH', () => {
    const hetzner = { ...base, cloud: { provider: 'hetzner' } }
    for (const config of [hetzner, routable]) {
      const plan = build(config, true)
      const phases = plan.operations.map(op => op.phase)
      expect(phases).toContain('release')
      expect(phases).toContain('runtime')
      expect(phases).not.toContain('dns')
      expect(phases).not.toContain('tls')
      expect(phases).not.toContain('mail')
      expect(plan.operations.find(op => op.phase === 'gateway')?.detail).toContain('Post-release DNS and TLS reconciliation is held.')
      expect(formatDeploymentPreview(plan)).toContain('Post-release DNS and TLS reconciliation is held.')
    }
  })
})

it('previews the selected mail environment without sending a webhook', () => {
  const root = resolve(import.meta.dir, '../../../../..')
  const directory = mkdtempSync(join(tmpdir(), 'buddy-mail-deploy-preview-'))

  try {
    mkdirSync(join(directory, 'config'))
    mkdirSync(join(directory, 'storage/framework/core'), { recursive: true })
    symlinkSync(join(root, 'node_modules'), join(directory, 'node_modules'), 'dir')
    symlinkSync(join(root, 'storage/framework/core/buddy'), join(directory, 'storage/framework/core/buddy'), 'dir')
    writeFileSync(join(directory, 'package.json'), '{"name":"mail-deploy-preview-fixture"}')
    writeFileSync(join(directory, 'bunfig.toml'), 'preload = []')
    writeFileSync(join(directory, 'config/cloud.ts'), `export const tsCloud = {
      project: { slug: 'mail-preview' },
      cloud: { provider: 'hetzner' },
      sites: { web: { domain: 'www.example.com', start: 'bun server.ts' } },
    }`)
    writeFileSync(join(directory, 'config/email.ts'), `
      if (process.env.MAIL_ON === 'broken') throw new Error('fixture-password')
      export default {
        domain: process.env.MAIL_DOMAIN,
        server: { enabled: process.env.MAIL_ON === 'true', attachTo: process.env.MAIL_OWNER },
        mailboxes: [{ email: 'info', password: 'fixture-password' }],
      }
    `)
    const targetEnv = 'MAIL_DOMAIN=target.example.com\nMAIL_ON=true\nMAIL_OWNER=target-box\n'
    writeFileSync(join(directory, 'target.env'), `${targetEnv}STACKS_DEPLOY_HOLD_DNS=0\n`)
    writeFileSync(join(directory, '.env.production'), `${targetEnv}STACKS_DEPLOY_HOLD_DNS=0\n`)
    writeFileSync(join(directory, 'inherit.env'), targetEnv)
    writeFileSync(join(directory, 'broken.env'), 'MAIL_ON=broken\n')
    const preload = join(directory, 'preload.ts')
    writeFileSync(preload, `
      import { awaitConfig } from ${JSON.stringify(join(root, 'storage/framework/core/config/src/index.ts'))}
      await awaitConfig()
      globalThis.fetch = async () => {
        console.error('unexpected-preview-fetch')
        return new Response('ok')
      }
    `)

    const run = (args: string[], callerEnv: Record<string, string> = {}) => Bun.spawnSync([
      process.execPath,
      '--no-env-file',
      '--preload',
      preload,
      join(root, 'storage/framework/core/buddy/src/cli.ts'),
      'deploy',
      '--prod',
      '--dry-run',
      ...args,
    ], {
      cwd: directory,
      env: {
        ...process.env,
        STACKS_BUDDY_ROOT: directory,
        APP_ENV: 'development',
        NODE_ENV: 'development',
        MAIL_DOMAIN: 'launch.example.com',
        MAIL_ON: 'false',
        MAIL_OWNER: 'launch-box',
        DEPLOY_WEBHOOK_URL: 'https://hooks.slack.com/services/fixture/preview/unused',
        DEPLOY_WEBHOOK_NOTIFY: 'all',
        DEPLOY_WEBHOOK_DRIVER: 'slack',
        STACKS_DEPLOY_HOLD_DNS: '0',
        ...callerEnv,
      },
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const json = run(['--json', '--env-file', 'target.env'])
    const human = run(['--env-file', 'target.env'])
    const failed = run(['--json', '--env-file', 'missing.env'])
    const brokenMail = run(['--json', '--env-file', 'broken.env'])
    const held = [
      run(['--json', '--hold-dns', '--env-file', 'target.env']),
      run(['--json', '--hold-dns']),
      run(['--json', '--env-file', 'inherit.env'], { STACKS_DEPLOY_HOLD_DNS: '1' }),
    ]
    for (const result of [json, human, failed, brokenMail, ...held]) {
      const output = `${result.stdout}${result.stderr}`
      expect(output).not.toContain('unexpected-preview-fetch')
      expect(output).not.toContain('fixture-password')
    }

    const parsePlan = (result: ReturnType<typeof run>) => {
      expect(result.exitCode, `${result.stdout}${result.stderr}`).toBe(0)
      const line = result.stdout.toString().split('\n').find(line => line.startsWith(deploymentPreviewJsonPrefix))
      expect(line).toBeDefined()
      return JSON.parse(line!.slice(deploymentPreviewJsonPrefix.length)) as ReturnType<typeof createDeploymentPreview>
    }
    const plan = parsePlan(json)
    expect(plan.operations.find(op => op.phase === 'mail')?.detail ?? '').toContain("target.example.com on the attached 'target-box' server")
    expect(human.exitCode, `${human.stdout}${human.stderr}`).toBe(0)
    expect(human.stdout.toString()).toContain('Reconcile mail tenant')
    expect(failed.exitCode).not.toBe(0)
    expect(`${failed.stdout}${failed.stderr}`).toContain('The selected deployment environment file does not exist')
    expect(parsePlan(brokenMail).operations.some(op => op.phase === 'mail')).toBe(false)
    expect(brokenMail.stdout.toString()).toContain('Skipping mail reconciliation')
    for (const result of held) {
      const phases = parsePlan(result).operations.map(op => op.phase)
      expect(phases).toContain('gateway')
      expect(phases).not.toContain('dns')
      expect(phases).not.toContain('tls')
      expect(phases).not.toContain('mail')
    }
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
}, 30_000)
