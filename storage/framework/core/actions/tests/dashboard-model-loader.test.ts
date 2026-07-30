import { describe, expect, it } from 'bun:test'
import { loadModel } from '../../../defaults/resources/functions/dashboard/data'

describe('dashboard model loader', () => {
  it('loads framework models that are not in the legacy fast-path map', async () => {
    const Model = await loadModel('AnalyticsEvent')

    expect(Model._isStub).not.toBe(true)
    expect(Model.name).toBe('AnalyticsEvent')
    expect(typeof Model.where).toBe('function')
    expect(Model.traits.useApi.routes).toContain('store')
  })

  it('returns a safe stub when no model file exists', async () => {
    const Model = await loadModel('DefinitelyMissingDashboardModel')

    expect(Model._isStub).toBe(true)
    expect(await Model.all()).toEqual([])
  })
})
