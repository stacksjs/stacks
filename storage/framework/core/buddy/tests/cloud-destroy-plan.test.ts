import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { destroyEffects, planServerDestroy } from '../src/commands/cloud'

/**
 * A teardown is the one fleet operation with nothing to undo, so what is worth
 * testing is the shape of the plan rather than the deletion: which steps exist,
 * which one is marked irreversible, and when each one considers itself already
 * done - that last being what lets a run that died halfway be re-run.
 */

const ENV_VARS = ['HCLOUD_TOKEN', 'HETZNER_API_TOKEN', 'CLOUD_PROVIDER', 'TS_CLOUD_STATE_DIR'] as const

let saved: Record<string, string | undefined>
let cwd: string

beforeEach(() => {
  saved = Object.fromEntries(ENV_VARS.map(k => [k, process.env[k]]))
  for (const k of ENV_VARS) delete process.env[k]
  cwd = process.cwd()
  process.chdir(mkdtempSync(join(tmpdir(), 'cloud-destroy-')))
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
const pinPath = 'storage/cloud/state/shop-production.json'

function pin(state: Record<string, unknown>): void {
  mkdirSync('storage/cloud/state', { recursive: true })
  writeFileSync(pinPath, JSON.stringify(state))
}

describe('planServerDestroy', () => {
  it('marks the deletion irreversible and nothing else', () => {
    const plan = planServerDestroy('shop-production-app', {
      providerExists: async () => true,
      deleteProvider: async () => {},
      pinnedName: async () => 'shop-production-app',
      clearPin: async () => {},
    })

    expect(plan.operation).toBe('server:destroy')
    expect(plan.target).toBe('shop-production-app')
    expect(plan.steps.map(step => step.id)).toEqual(['provider:delete', 'state:clear'])
    expect(plan.steps.map(step => Boolean(step.destructive))).toEqual([true, false])
  })

  /**
   * The other order reads as safer and is not: a crash between the two would
   * leave a live server that nothing points at, which is what gets forgotten.
   */
  it('deletes before it clears the pin', () => {
    const plan = planServerDestroy('box', {
      providerExists: async () => true,
      deleteProvider: async () => {},
      pinnedName: async () => 'box',
      clearPin: async () => {},
    })

    expect(plan.steps[0].id).toBe('provider:delete')
  })

  it('has no pin step when no pin names the server', () => {
    const plan = planServerDestroy('box', { providerExists: async () => true, deleteProvider: async () => {} })

    expect(plan.steps.map(step => step.id)).toEqual(['provider:delete'])
  })

  it('counts a server that is already gone as satisfied, so a re-run resumes', async () => {
    const plan = planServerDestroy('box', { providerExists: async () => false, deleteProvider: async () => {} })

    expect(await plan.steps[0].satisfied()).toBe(true)
  })

  it('counts a pin that has moved on as satisfied', async () => {
    const plan = planServerDestroy('box', {
      providerExists: async () => true,
      deleteProvider: async () => {},
      pinnedName: async () => undefined,
      clearPin: async () => {},
    })

    expect(await plan.steps[1].satisfied()).toBe(true)
  })
})

describe('destroyEffects', () => {
  it('refuses to pretend it deleted anything without a provider API', async () => {
    const effects = await destroyEffects({ project: { slug: 'shop' }, cloud: { provider: 'ssh' } }, server)

    expect(await effects.providerExists()).toBe(true)
    expect(effects.deleteProvider()).rejects.toThrow(/cannot be deleted from here/)
  })

  it('empties the pin rather than deleting the file, so the stack re-provisions', async () => {
    pin({ provider: 'hetzner', stackName: 'shop-production', serverId: 501, serverName: 'shop-production-app', publicIp: '1.2.3.4' })
    const effects = await destroyEffects(hetzner, server)

    expect(await effects.pinnedName!()).toBe('shop-production-app')
    await effects.clearPin!()

    const after = JSON.parse(readFileSync(pinPath, 'utf8'))
    expect(after.serverId).toBeUndefined()
    expect(after.serverName).toBeUndefined()
    expect(after.publicIp).toBe('1.2.3.4')
    expect(after.stackName).toBe('shop-production')
  })

  it('leaves a pin that names some other server alone', async () => {
    pin({ provider: 'hetzner', stackName: 'shop-production', serverId: 77, serverName: 'shop-production-lb' })
    const effects = await destroyEffects(hetzner, server)

    expect(effects.clearPin).toBeUndefined()
  })
})
