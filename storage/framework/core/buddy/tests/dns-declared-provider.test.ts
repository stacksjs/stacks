import { describe, expect, it } from 'bun:test'
import { declaredDnsProvider, declaredDnsProviderProblem, dnsProviderConfigsFromEnv } from '../src/commands/deploy'

/**
 * A declared DNS provider is a statement about who administers the zone, not a
 * preference to be weighed against whatever credentials happen to be around.
 *
 * WildLoop declared Porkbun and its production environment carried AWS keys
 * (for S3 and SES). The deploy tried Route53, failed with InvalidClientTokenId,
 * and reported "ignoring a configured provider ... credentials were rejected" —
 * an AWS error for a provider the project never asked for. Mail DNS then went
 * unpublished for a domain that was sitting at Porkbun the whole time.
 */
describe('declared DNS provider', () => {
  const withEnv = <T>(vars: Record<string, string | undefined>, fn: () => T): T => {
    const saved: Record<string, string | undefined> = {}
    for (const [k, v] of Object.entries(vars)) {
      saved[k] = process.env[k]
      if (v === undefined)
        delete process.env[k]
      else process.env[k] = v
    }
    try {
      return fn()
    }
    finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined)
          delete process.env[k]
        else process.env[k] = v
      }
    }
  }

  it('reads the provider from either config shape', () => {
    expect(declaredDnsProvider({ infrastructure: { dns: { provider: 'porkbun' } } })).toBe('porkbun')
    expect(declaredDnsProvider({ tsCloud: { infrastructure: { dns: { provider: 'Cloudflare' } } } })).toBe('cloudflare')
    expect(declaredDnsProvider({})).toBeUndefined()
  })

  it('never returns a provider the project did not declare', () => {
    withEnv({ AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE', PORKBUN_API_KEY: 'pk', PORKBUN_SECRET_KEY: 'sk' }, () => {
      const configs = dnsProviderConfigsFromEnv('porkbun')
      expect(configs).toHaveLength(1)
      expect(configs[0].provider).toBe('porkbun')
    })
  })

  it('refuses to fall through to another registrar when the declared one has no credentials', () => {
    withEnv({ AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE', PORKBUN_API_KEY: undefined, PORKBUN_SECRET_KEY: undefined }, () => {
      const configs = dnsProviderConfigsFromEnv('porkbun')
      // The AWS keys are present and would previously have been used.
      expect(configs).toHaveLength(0)

      const problem = declaredDnsProviderProblem('porkbun', configs)
      expect(problem).toContain('PORKBUN_API_KEY')
      expect(problem).toContain('PORKBUN_SECRET_KEY')
      // Names the fix, not just the failure.
      expect(problem).toContain('.env.production')
    })
  })

  it('still probes everything available when nothing is declared', () => {
    withEnv({ AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE', PORKBUN_API_KEY: 'pk', PORKBUN_SECRET_KEY: 'sk' }, () => {
      const providers = dnsProviderConfigsFromEnv().map((c: any) => c.provider)
      expect(providers).toContain('porkbun')
      expect(providers).toContain('route53')
    })
  })

  it('reports nothing wrong when the declared provider has credentials', () => {
    withEnv({ PORKBUN_API_KEY: 'pk', PORKBUN_SECRET_KEY: 'sk' }, () => {
      expect(declaredDnsProviderProblem('porkbun', dnsProviderConfigsFromEnv('porkbun'))).toBeUndefined()
    })
  })

  it('says so when the declared provider is not one it can drive', () => {
    expect(declaredDnsProviderProblem('namecheap', [])).toContain('not one this deploy knows how to drive')
  })
})
