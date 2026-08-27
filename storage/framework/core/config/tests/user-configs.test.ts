import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(import.meta.dir, '../src/overrides.ts'), 'utf-8')

/**
 * `userConfigs` is the allowlist of `config/*.ts` files the framework reads.
 * A file missing from it is not a warning or an error — it is read by nothing,
 * while sitting in the project looking authoritative.
 */
describe('userConfigs allowlist', () => {
  /**
   * `app/Middleware/Cors.ts` documents `config/cors.ts` as the place to
   * configure CORS, and `StacksConfig` declares `cors?: CorsConfig` — but the
   * entry was missing here, so the middleware always fell back to its defaults
   * (`origin: '*'`, `credentials: false`). A browser refuses a credentialed
   * cross-origin request answered with a wildcard origin, so an app whose
   * frontend and API sit on different origins could not log in at all.
   */
  it('includes cors, so config/cors.ts is actually read', () => {
    expect(source).toContain(`['cors', 'cors']`)
  })

  it('still includes the entries apps already depend on', () => {
    for (const key of ['app', 'auth', 'database', 'email', 'ports', 'server'])
      expect(source).toContain(`['${key}', '${key}']`)
  })
})
