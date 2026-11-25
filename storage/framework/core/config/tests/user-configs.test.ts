import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { USER_CONFIG_FILES } from '../src/sources'

const entries = USER_CONFIG_FILES.map(entry => [...entry])
const keys = new Set(USER_CONFIG_FILES.map(([key]) => key))

/**
 * `USER_CONFIG_FILES` is the allowlist of `config/*.ts` files the framework reads.
 * A file missing from it is not a warning or an error — it is read by nothing,
 * while sitting in the project looking authoritative.
 */
describe('USER_CONFIG_FILES allowlist', () => {
  /**
   * `app/Middleware/Cors.ts` documents `config/cors.ts` as the place to
   * configure CORS, and `StacksConfig` declares `cors?: CorsConfig` — but the
   * entry was missing here, so the middleware always fell back to its defaults
   * (`origin: '*'`, `credentials: false`). A browser refuses a credentialed
   * cross-origin request answered with a wildcard origin, so an app whose
   * frontend and API sit on different origins could not log in at all.
   */
  it('includes cors, so config/cors.ts is actually read', () => {
    expect(entries).toContainEqual(['cors', 'cors'])
  })

  it('still includes the entries apps already depend on', () => {
    for (const key of ['app', 'auth', 'database', 'email', 'ports', 'server'])
      expect(entries).toContainEqual([key, key])
  })

  /**
   * `config/sms.ts` was the third file to go missing from this list, after
   * `cors` and `socials` (stacksjs/stacks#2876). It ships in every scaffolded
   * app and declares the provider, drivers and credentials, and `config.sms`
   * was the framework default no matter what it said. It hid for so long
   * because the default happens to match the shipped file's first two values,
   * so the resolved config looked right until you changed the file.
   *
   * Spot-checking names cannot catch the next one. The invariant is exact: a
   * section declared in `StacksOptions` is a section an application can write
   * a config file for, so every one of them needs an entry here. It holds with
   * no exceptions today, which is why this needs no allowlist.
   */
  it('has an entry for every section StacksOptions declares', () => {
    const stacks = readFileSync(resolve(import.meta.dir, '../../types/src/stacks.ts'), 'utf-8')
    const body = stacks.slice(stacks.indexOf('export interface StacksOptions'))
    const declared = [...body.slice(0, body.indexOf('\n}')).matchAll(/^\s{2}(\w+)\??:\s*\w+/gm)].map(m => m[1])

    expect(declared.length).toBeGreaterThan(30)
    expect(declared.filter(section => !keys.has(section))).toEqual([])
  })
})
