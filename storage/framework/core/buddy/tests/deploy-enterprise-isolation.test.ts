import { expect, it } from 'bun:test'
import { assertAttachResidency, mergeSiteDeployEnv } from '../src/commands/deploy'

it('keeps deployment credentials out of an explicitly isolated runtime environment', () => {
  const sites = mergeSiteDeployEnv({
    training: { inheritEnv: false, port: 3250, env: { APP_NAME: 'LSU', DB_PASSWORD: 'own-db' } },
    website: { port: 3200, env: { APP_NAME: 'LSU website' } },
  }, { HCLOUD_TOKEN: 'provider-secret', CLOUDFLARE_API_TOKEN: 'dns-secret', APP_KEY: 'website-key', PORT: '3000' })
  expect(sites.training.env).toEqual({ APP_NAME: 'LSU', DB_PASSWORD: 'own-db' })
  expect(sites.website.env.HCLOUD_TOKEN).toBe('provider-secret')
  expect(sites.website.env.PORT).toBeUndefined()
})

it('requires fresh country and location evidence and rejects missing or foreign residency', () => {
  const policy = { countries: ['DE'], locations: ['fsn1'] }
  expect(() => assertAttachResidency(policy, { country: 'DE', location: 'fsn1' })).not.toThrow()
  for (const evidence of [{}, { country: 'US', location: 'ash' }, { country: 'DE', location: 'nbg1' }, { location: 'fsn1' }])
    expect(() => assertAttachResidency(policy, evidence)).toThrow()
  expect(() => assertAttachResidency({ countries: [] }, { country: 'DE', location: 'fsn1' })).toThrow()
})
