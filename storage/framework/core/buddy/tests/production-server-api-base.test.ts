import { describe, expect, it } from 'bun:test'
import { resolveApiBase } from '../src/production-server'

/**
 * The production page server reverse-proxies `/api/**` to the API process.
 * Picking that target by falling back to a framework-wide default port is only
 * safe when the app owns the machine. ts-cloud deliberately packs many SSR
 * sites onto one instance (SiteConfig.port: "Two SSR sites on the same EC2
 * instance must use different ports"), so on a deployed box the default port
 * belongs to whichever tenant bound it first — and proxying there hands that
 * tenant this app's session cookies and login POSTs.
 */
describe('resolveApiBase', () => {
  const deployedEnvs = ['production', 'staging', 'development']

  it('prefers an explicit API_URL over everything else', () => {
    const base = resolveApiBase(3008, {
      API_URL: 'http://10.0.0.4:9000',
      PORT_API: '3101',
      APP_ENV: 'production',
    } as NodeJS.ProcessEnv)

    expect(base).toBe('http://10.0.0.4:9000')
  })

  it('uses PORT_API when set, in any environment', () => {
    for (const APP_ENV of [...deployedEnvs, 'test', '']) {
      expect(resolveApiBase(3008, { PORT_API: '3101', APP_ENV } as NodeJS.ProcessEnv))
        .toBe('http://127.0.0.1:3101')
    }
  })

  it.each(deployedEnvs)('refuses to guess a loopback port in %s', (APP_ENV) => {
    expect(resolveApiBase(3008, { APP_ENV } as NodeJS.ProcessEnv)).toBeNull()
  })

  it('does not treat the scaffold ports.api default as explicit intent', () => {
    // config/ports.ts ships `api: env.PORT_API ?? 3008`, so a configured value
    // is indistinguishable from the untouched default. Trusting it would put
    // the cross-tenant proxy straight back.
    expect(resolveApiBase(3008, { APP_ENV: 'production' } as NodeJS.ProcessEnv)).toBeNull()
    expect(resolveApiBase(3101, { APP_ENV: 'production' } as NodeJS.ProcessEnv)).toBeNull()
  })

  it('still falls back to the configured port locally, where the app owns the host', () => {
    expect(resolveApiBase(3008, { APP_ENV: 'test' } as NodeJS.ProcessEnv))
      .toBe('http://127.0.0.1:3008')
    expect(resolveApiBase(undefined, {} as NodeJS.ProcessEnv))
      .toBe('http://127.0.0.1:3008')
  })
})
