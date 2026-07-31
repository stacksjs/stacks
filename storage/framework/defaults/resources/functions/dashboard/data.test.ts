import { describe, expect, test } from 'bun:test'
import {
  allRows,
  countRows,
  DashboardModelLoadError,
  loadModel,
  loadModelIfExists,
  safeGet,
} from './data'

describe('dashboard model data helpers', () => {
  test('returns real rows and counts without inventing fallback data', async () => {
    const rows = [{ id: 1 }, { id: 2 }]

    expect(await allRows({ all: async () => rows })).toEqual(rows)
    expect(await countRows({ count: async () => 0 })).toBe(0)
    expect(await countRows({ all: async () => rows })).toBe(2)
  })

  test('surfaces query failures and invalid query results', async () => {
    const failure = new Error('database unavailable')

    await expect(allRows({ all: async () => { throw failure } })).rejects.toBe(failure)
    await expect(allRows({ all: async () => ({}) })).rejects.toThrow('did not return an array')
    await expect(countRows({ count: async () => Number.NaN })).rejects.toThrow('finite number')
  })

  test('distinguishes optional missing models from strict model loads', async () => {
    const name = 'DefinitelyMissingDashboardModelForContract'

    expect(await loadModelIfExists(name)).toBeNull()
    await expect(loadModel(name)).rejects.toBeInstanceOf(DashboardModelLoadError)
  })

  test('does not hide model accessor failures', () => {
    const failure = new Error('accessor failed')
    const row = {
      get() {
        throw failure
      },
    }

    expect(() => safeGet(row, 'name')).toThrow(failure)
  })
})
