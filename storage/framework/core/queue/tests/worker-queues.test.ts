import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { namedWorkerQueues } from '../src/worker'

/**
 * `buddy queue:work --queue=emails` took every queue in the table ten seconds
 * in: the loop's periodic refresh replaced the list the operator asked for,
 * so jobs meant for other workers ran here. And `--queue=high,default` was
 * one queue literally named "high,default".
 */
describe('the queues a worker takes', () => {
  it('reads a comma-separated list, in order', () => {
    expect(namedWorkerQueues('high,default')).toEqual(['high', 'default'])
    expect(namedWorkerQueues(' emails ')).toEqual(['emails'])
    expect(namedWorkerQueues('high, high ,low')).toEqual(['high', 'low'])
  })

  it('is no list at all when nothing was named', () => {
    expect(namedWorkerQueues(undefined)).toEqual([])
    expect(namedWorkerQueues(false)).toEqual([])
    expect(namedWorkerQueues('')).toEqual([])
  })

  it('only follows new queues when none were named', () => {
    // The loop itself polls forever; what matters is that its refresh is
    // gated on this, which is read straight off the source.
    const source = readFileSync(new URL('../src/worker.ts', import.meta.url), 'utf8')
    expect(source).toContain('{ followNewQueues: named.length === 0 }')
    expect(source).toContain('if (options.followNewQueues && now - lastQueueRefresh > queueRefreshInterval)')
  })
})
