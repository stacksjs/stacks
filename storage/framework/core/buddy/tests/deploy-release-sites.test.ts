import { describe, expect, test } from 'bun:test'
import type { SiteConfig } from '@stacksjs/ts-cloud'
import { shipsARelease } from '@stacksjs/ts-cloud'
import { deploymentReleaseSites } from '../src/commands/deploy'

const policy = { shipsARelease }
const sites: Record<string, SiteConfig | undefined> = {
  app: { domain: 'forge.test', root: '.', start: 'bun serve', port: 3072 },
  api: { domain: 'forge.test', path: '/api', root: '.', start: 'bun api', port: 3073 },
  git: { domain: 'forge.test', path: '/git', proxyTo: '127.0.0.1:3073' },
  // A stale root/start must not turn an externally managed upstream into an
  // application package or a GitHub application deployment record.
  legacyProxy: { domain: 'external.test', proxyTo: '127.0.0.1:9000', root: '.', start: 'old service' },
  redirect: { domain: 'www.forge.test', redirect: 'https://forge.test', root: '.' },
  static: { domain: 'docs.forge.test', deploy: 'server', root: 'dist/docs' },
  bucket: { domain: 'cdn.forge.test', root: 'dist' },
  absent: undefined,
}

describe('release selection shared by packaging and deployment records', () => {
  test('only packages sites whose application releases are managed by this deployment', () => {
    expect(deploymentReleaseSites(sites, undefined, policy).map(([name]) => name)).toEqual(['app', 'api', 'static'])
  })

  test('a surgical Git gateway deployment has no application tarball or deployment record', () => {
    expect(deploymentReleaseSites(sites, 'git', policy)).toEqual([])
    expect(deploymentReleaseSites(sites, 'legacyProxy', policy)).toEqual([])
  })

  test('a surgical API deployment keeps the existing API release exactly once', () => {
    expect(deploymentReleaseSites(sites, 'api', policy)).toEqual([['api', sites.api]])
    expect(deploymentReleaseSites(sites, 'absent', policy)).toEqual([])
  })
})

// The preview must describe the same gateway-only operation as the live CLI.
test('a surgical proxy preview promises no build, package, release or runtime restart', async () => {
  const { createDeploymentPreview } = await import('../src/commands/deploy-preview')
  const { resolveSiteKind } = await import('@stacksjs/ts-cloud')
  const preview = createDeploymentPreview({
    config: { project: { name: 'Forge', slug: 'forge' }, cloud: { provider: 'hetzner', attachTo: 'shared' }, sites },
    environment: 'production',
    site: 'git',
    resolveSiteKind,
    applyEnvironmentToSites: value => value,
  })
  expect(preview.sites.find(site => site.name === 'git')?.kind).toBe('proxy')
  expect(preview.operations.filter(operation => ['build', 'package', 'release', 'runtime'].includes(operation.phase))).toEqual([])
  expect(preview.operations.find(operation => operation.phase === 'gateway')).toBeDefined()
})
