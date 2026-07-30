import { describe, expect, it } from 'bun:test'
import { modelCreateFields, modelSchemaColumns } from '../../../defaults/app/Actions/Dashboard/Models/model-write'
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

  it('derives empty-table columns from the model migration definition', async () => {
    const Model = await loadModel('OrderIdempotency')

    expect(modelSchemaColumns(Model)).toEqual([
      'id',
      'idempotency_key',
      'order_id',
      'created_at',
      'updated_at',
    ])
  })

  it('honors attribute-level required declarations in generated forms', async () => {
    const Model = await loadModel('EmailList')
    const fields = modelCreateFields(Model)

    expect(fields.find(field => field.name === 'name')?.required).toBe(true)
    expect(fields.find(field => field.name === 'status')?.required).toBe(true)
    expect(fields.find(field => field.name === 'description')?.required).toBe(false)
  })
})
