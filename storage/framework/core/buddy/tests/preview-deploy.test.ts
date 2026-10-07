import { describe, expect, it } from 'bun:test'
import { assertPreviewName, buildPreviewTeardownScript, derivePreviewConfig, previewDomain, previewPort, previewSite, previewTarget } from '../src/commands/preview-deploy'

/**
 * Preview deployments (stacksjs/stacks#735): a pull request as its own tenant
 * on the app's box. What is derived from the app's config, and what removal
 * touches - which must be the preview's own names and nothing that merely
 * starts like them.
 */

const app = {
  project: { name: 'Acme', slug: 'acme', stackName: 'acme-prod' },
  cloud: { provider: 'hetzner', previews: { domain: 'preview.acme.dev' }, retiredDomains: ['old.acme.dev'] },
  environments: { staging: { domainPrefix: 'staging' } },
  sites: {
    web: {
      domain: 'acme.dev',
      port: 3000,
      start: 'bun run start',
      aliases: ['www.acme.dev'],
      env: { CALLBACK_URL: 'https://acme.dev/oauth/callback', API_URL: 'https://api.other.dev', RETRIES: 3 },
    },
    docs: { domain: 'docs.acme.dev', deploy: 'server' },
    legacy: { domain: 'old.acme.dev', redirect: 'https://acme.dev' },
  },
}

describe('preview names and targets', () => {
  it('accepts names usable as a hostname label, a unit name and a slug', () => {
    expect(assertPreviewName('pr-123')).toBe('pr-123')
    for (const bad of ['PR-1', 'pr_1', '-pr', 'pr-', 'pr.1', '', 'a'.repeat(31)])
      expect(() => assertPreviewName(bad)).toThrow('not a usable preview name')
  })

  it('reads the preview domain from config, then PREVIEW_DOMAIN', () => {
    expect(previewDomain(app, {})).toBe('preview.acme.dev')
    expect(previewDomain({ cloud: {} }, { PREVIEW_DOMAIN: '*.Previews.Acme.Dev.' })).toBe('previews.acme.dev')
    expect(() => previewDomain({ cloud: {} }, {})).toThrow('cloud.previews.domain')
    expect(() => previewDomain({ cloud: { previews: { domain: 'localhost' } } }, {})).toThrow('not a domain')
  })

  it('previews the named site, else the first that runs a server', () => {
    expect(previewSite(app)).toBe('web')
    expect(previewSite({ ...app, cloud: { previews: { site: 'docs' } } })).toBe('docs')
    expect(() => previewSite({ ...app, cloud: { previews: { site: 'nope' } } })).toThrow('does not declare')
    expect(() => previewSite({ sites: { legacy: app.sites.legacy } })).toThrow('nothing to preview')
  })

  it('is its own slug, attached to the box the app runs on', () => {
    expect(previewTarget(app, 'pr-7', 'preview.acme.dev')).toEqual({
      slug: 'acme-pr-7',
      owner: 'acme',
      site: 'web',
      host: 'pr-7.preview.acme.dev',
      url: 'https://pr-7.preview.acme.dev',
    })
    // A tenant's previews attach to the same box the tenant does.
    expect(previewTarget({ ...app, cloud: { ...app.cloud, attachTo: 'stacks' } }, 'pr-7', 'preview.acme.dev').owner).toBe('stacks')
  })

  it('refuses a name whose units would share a prefix with one of the app\'s sites', () => {
    const withSite = { ...app, sites: { ...app.sites, 'pr-7-web': { domain: 'x.acme.dev', start: 'x' } } }
    expect(() => previewTarget(withSite, 'pr-7', 'preview.acme.dev')).toThrow('would share unit names')
  })
})

describe('derivePreviewConfig', () => {
  const target = previewTarget(app, 'pr-7', 'preview.acme.dev')
  const derived = derivePreviewConfig(app, target, 3007)

  it('is the preview project, attached to the app\'s box, serving only the preview site', () => {
    expect(derived.project).toEqual({ name: 'Acme', slug: 'acme-pr-7' })
    expect(derived.cloud).toEqual({ provider: 'hetzner', attachTo: 'acme' })
    expect(Object.keys(derived.sites)).toEqual(['web'])
    expect(derived.sites.web).toMatchObject({ domain: 'pr-7.preview.acme.dev', port: 3007, start: 'bun run start', aliases: undefined, www: false })
    expect(derived.environments).toBeUndefined()
  })

  it('points the site\'s own-host URLs at the preview, and sets APP_URL', () => {
    expect(derived.sites.web.env).toEqual({
      CALLBACK_URL: 'https://pr-7.preview.acme.dev/oauth/callback',
      API_URL: 'https://api.other.dev',
      RETRIES: 3,
      APP_URL: 'https://pr-7.preview.acme.dev',
    })
  })

  it('leaves the app\'s config as it was', () => {
    expect(app.project.slug).toBe('acme')
    expect(app.sites.web.domain).toBe('acme.dev')
    expect(Object.keys(app.sites)).toEqual(['web', 'docs', 'legacy'])
  })
})

describe('previewPort', () => {
  const owners = new Map([[3000, 'acme'], [3001, 'acme-pr-1'], [3002, 'other']])

  it('keeps the port a preview already has, on a redeploy', () => {
    expect(previewPort(owners, 'acme-pr-1', 3000)).toBe(3001)
  })

  it('takes the first free port at or above the app site\'s', () => {
    expect(previewPort(owners, 'acme-pr-9', 3000)).toBe(3003)
  })

  it('says so when the range is full', () => {
    expect(() => previewPort(new Map([[3000, 'a'], [3001, 'b']]), 'acme-pr-9', 3000, { start: 3000, end: 3001 })).toThrow('No free port')
  })
})

describe('buildPreviewTeardownScript', () => {
  const script = buildPreviewTeardownScript('acme-pr-1', 'web')

  it('is valid shell', () => {
    const check = Bun.spawnSync(['bash', '-n'], { stdin: new TextEncoder().encode(script) })
    expect(check.exitCode).toBe(0)
  })

  it('selects exactly this preview\'s units, never the app\'s or a sibling preview\'s', () => {
    const pattern = /grep -E '([^']+)'/.exec(script.split('\n').find(line => line.includes('/etc/systemd/system/ 2>/dev/null | grep -E'))!)![1]!
    const listing = [
      'acme-pr-1-web.service', 'acme-pr-1-web@.service', 'acme-pr-1-web@a1b2.service', 'acme-pr-1-web-liveness.service',
      'acme-pr-1-web-liveness.timer', 'acme-pr-1-web-scheduler.service', 'acme-pr-1-web-queue-0.service', 'acme-pr-1-web-daemon-mail-0.service',
      // the app's own, and other previews'
      'acme-web.service', 'acme-pr-10-web.service', 'acme-pr-1-web2.service', 'acme-pr-1-docs-web.service',
      'rpx-gateway.service',
    ].join('\n')
    const grep = Bun.spawnSync(['grep', '-E', pattern], { stdin: new TextEncoder().encode(listing) })
    expect(grep.stdout.toString().trim().split('\n')).toEqual([
      'acme-pr-1-web.service', 'acme-pr-1-web@.service', 'acme-pr-1-web@a1b2.service', 'acme-pr-1-web-liveness.service',
      'acme-pr-1-web-liveness.timer', 'acme-pr-1-web-scheduler.service', 'acme-pr-1-web-queue-0.service', 'acme-pr-1-web-daemon-mail-0.service',
    ])
  })

  it('skips a unit belonging to a longer-named sibling preview whose fragment is still there', () => {
    // `pr-1-web-queue` beside `pr-1`: its units match pr-1's queue pattern by
    // prefix, so the script consults the box's fragments before touching one.
    expect(script).toContain('others=$(ls /etc/rpx/sites.d/ 2>/dev/null | sed -n \'s/^\\(acme-pr-1-.*\\)\\.json$/\\1/p\')')
    expect(script).toContain('for other in $others; do case "$unit" in "$other"-*) skip=1 ;; esac; done')
  })

  it('removes exact paths, never a glob on the slug', () => {
    expect(script).toContain('rm -rf /var/www/acme-pr-1-web /var/www/acme-pr-1-shared /usr/local/sbin/acme-pr-1-web-liveness')
    expect(script).toContain('/etc/rpx/sites.d/acme-pr-1.json')
    expect(script).not.toMatch(/\/var\/www\/acme-pr-1-\*/)
  })

  it('refuses a slug or site that could widen what it removes', () => {
    expect(() => buildPreviewTeardownScript('acme-*', 'web')).toThrow('Refusing')
    expect(() => buildPreviewTeardownScript('acme-pr-1', '../etc')).toThrow('Refusing')
  })
})
