import type { CloudConfig, ComputeChangePlan } from '@stacksjs/ts-cloud'
import { describe, expect, it } from 'bun:test'
import { applyConfiguredCompute } from './apply-compute'

const config: CloudConfig = { project: { name: 'Test', slug: 'test', region: 'fsn1' }, environments: { production: { type: 'production' } } }
const ready: ComputeChangePlan = { serverId: '42', changes: [{ resource: 'test', action: 'resize', detail: 'configured target' }] }
const done: ComputeChangePlan = { serverId: '42', changes: [] }

function driver(plans: ComputeChangePlan[]) {
  const calls: boolean[] = []
  return { calls, applyComputeChanges: async (options: { dryRun?: boolean }) => {
    calls.push(!!options.dryRun)
    return plans.shift()!
  } }
}

describe('scheduled configured compute apply', () => {
  it('stays read-only while capacity is unavailable', async () => {
    const client = driver([{ ...done, waitingForCapacity: 'unavailable' }])
    expect((await applyConfiguredCompute(client, config, 'production', false)).state).toBe('waiting')
    expect(client.calls).toEqual([true])
  })
  it('keeps dry runs read-only even with capacity', async () => {
    const client = driver([ready])
    expect((await applyConfiguredCompute(client, config, 'production', true)).state).toBe('ready')
    expect(client.calls).toEqual([true])
  })
  it('applies through the native driver and verifies before retiring the workflow', async () => {
    const client = driver([ready, ready, done])
    expect((await applyConfiguredCompute(client, config, 'production', false)).state).toBe('done')
    expect(client.calls).toEqual([true, false, true])
  })
  it('does not retire a resize that remains pending', async () => {
    const client = driver([ready, ready, ready])
    await expect(applyConfiguredCompute(client, config, 'production', false)).rejects.toThrow('pending')
  })
})
