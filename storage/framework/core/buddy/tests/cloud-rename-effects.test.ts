import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { renameEffects } from '../src/commands/cloud'

/**
 * `cloud:rename` keeps four records in step, and `ServerRenameEffects` drops the
 * step for any capability the fleet cannot supply. So what matters here is not
 * that a rename works against a live provider - it is which capabilities each
 * kind of project offers, because an absent one silently shortens the plan and a
 * wrongly-present one makes the plan promise work it cannot do.
 */

const TOKEN_VARS = ['HCLOUD_TOKEN', 'HETZNER_API_TOKEN', 'CLOUD_PROVIDER', 'TS_CLOUD_STATE_DIR'] as const

let saved: Record<string, string | undefined>
let cwd: string

beforeEach(() => {
  saved = Object.fromEntries(TOKEN_VARS.map(k => [k, process.env[k]]))
  for (const k of TOKEN_VARS) delete process.env[k]
  cwd = process.cwd()
  // Driver state is read relative to the working directory, and a test must not
  // read (or write) the checkout's own pins.
  process.chdir(mkdtempSync(join(tmpdir(), 'cloud-rename-')))
})

afterEach(() => {
  process.chdir(cwd)
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const hetzner = { project: { slug: 'shop' }, cloud: { provider: 'hetzner' } }
const server = { id: '501', name: 'shop-production-app', ipv4: '167.233.116.134' }

function pin(state: Record<string, unknown>): void {
  mkdirSync('storage/cloud/state', { recursive: true })
  writeFileSync('storage/cloud/state/shop-production.json', JSON.stringify(state))
}

describe('renameEffects', () => {
  it('offers the names already taken, so the plan can refuse a collision', async () => {
    const effects = await renameEffects(hetzner, [server, { name: 'shop-production-lb' }], server, 'production')

    expect(await effects.takenNames()).toEqual(['shop-production-app', 'shop-production-lb'])
  })

  it('renames the inventory snapshot this run is holding', async () => {
    const held = { ...server }
    const effects = await renameEffects(hetzner, [held], held, 'production')

    expect(effects.inventoryName()).toBe('shop-production-app')
    await effects.renameInventory('shop-production-web')
    expect(effects.inventoryName()).toBe('shop-production-web')
  })

  it('gives an ssh fleet no provider step: its name lives in config/cloud.ts', async () => {
    const effects = await renameEffects(
      { project: { slug: 'shop' }, cloud: { provider: 'ssh' } },
      [server],
      server,
      'production',
    )

    expect(effects.renameProvider).toBeUndefined()
    expect(effects.providerName).toBeUndefined()
  })

  it('gives a Hetzner fleet a provider step once a token can be resolved', async () => {
    expect((await renameEffects(hetzner, [server], server, 'production')).renameProvider).toBeUndefined()

    process.env.HCLOUD_TOKEN = 'tok'
    const effects = await renameEffects(hetzner, [server], server, 'production')

    expect(typeof effects.renameProvider).toBe('function')
    expect(typeof effects.providerName).toBe('function')
  })

  it('has no provider step for a server the listing gave no numeric id', async () => {
    process.env.HCLOUD_TOKEN = 'tok'
    const effects = await renameEffects(hetzner, [server], { ...server, id: 'srv-abc' }, 'production')

    expect(effects.renameProvider).toBeUndefined()
  })

  /**
   * `findComputeTargets` rejects a pin whose recorded name no longer matches the
   * live one, so a provider rename that skips the pin quietly invalidates it.
   */
  it('rewrites the state pin when it names this server', async () => {
    pin({ provider: 'hetzner', stackName: 'shop-production', serverId: 501, serverName: 'shop-production-app' })
    const effects = await renameEffects(hetzner, [server], server, 'production')

    expect(await effects.stateName()).toBe('shop-production-app')
    await effects.writeStateName('shop-production-web')
    expect(await effects.stateName()).toBe('shop-production-web')
  })

  it('leaves a pin that names some other server alone', async () => {
    pin({ provider: 'hetzner', stackName: 'shop-production', serverId: 77, serverName: 'shop-production-lb' })
    const effects = await renameEffects(hetzner, [server], server, 'production')

    expect(effects.writeStateName).toBeUndefined()
  })

  it('has no state step when nothing is pinned', async () => {
    const effects = await renameEffects(hetzner, [server], server, 'production')

    expect(effects.stateName).toBeUndefined()
  })

  it('has no hostname step for a box with no address to reach', async () => {
    const effects = await renameEffects(hetzner, [server], { ...server, ipv4: undefined }, 'production')

    expect(effects.setRemoteHostname).toBeUndefined()
    expect(typeof (await renameEffects(hetzner, [server], server, 'production')).setRemoteHostname).toBe('function')
  })
})

/**
 * Regression: ts-cloud exports a `resolveHetznerApiToken` whose FIRST parameter
 * is the token and whose second is the config, while buddy's own resolver of
 * the same name takes the config. `cloud.ts` destructured ts-cloud's and passed
 * it the config, which typechecked (the config is `any` at that call) and then
 * called `.trim()` on an object - so every Hetzner fleet listing died with
 * `t?.trim is not a function` instead of listing servers.
 *
 * A source check rather than a behavioural one because the two functions are
 * interchangeable to the type system: nothing but the name distinguishes them.
 */
describe('the Hetzner token resolver buddy imports', () => {
  it('is never taken from @stacksjs/ts-cloud, whose argument order differs', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const dir = join(import.meta.dir, '..', 'src', 'commands')

    const offenders = readdirSync(dir)
      .filter(file => file.endsWith('.ts'))
      .filter((file) => {
        const source = readFileSync(join(dir, file), 'utf8')
        return /\{[^}]*\bresolveHetznerApiToken\b[^}]*\}\s*=\s*await import\(['"]@stacksjs\/ts-cloud['"]\)/.test(source)
          || /import\s*\{[^}]*\bresolveHetznerApiToken\b[^}]*\}\s*from\s*['"]@stacksjs\/ts-cloud['"]/.test(source)
      })

    expect(offenders).toEqual([])
  })
})
