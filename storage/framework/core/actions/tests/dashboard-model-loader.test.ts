import { describe, expect, it } from 'bun:test'
import { modelCreateFields, modelSchemaColumns, prepareModelFields } from '../../../defaults/app/Actions/Dashboard/Models/model-write'
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

  it('validates required create fields and coerces partial snake-case updates', async () => {
    const Model = await loadModel('EmailList')
    const create = prepareModelFields(Model, { status: 'active' })
    const update = prepareModelFields(Model, {
      subscriber_count: '2',
      unknown_id: 99,
    }, true)

    expect(create.errors.name).toEqual(['Name is required.'])
    expect(update).toEqual({
      data: { subscriberCount: 2 },
      errors: {},
    })
  })

  it('rejects invalid enum values before an update reaches the ORM', async () => {
    const Model = await loadModel('EmailList')
    const prepared = prepareModelFields(Model, { status: 'unknown' }, true)

    expect(prepared.data).toEqual({})
    expect(prepared.errors.status?.length).toBeGreaterThan(0)
  })

  it('allows optional model fields to be cleared by PATCH', async () => {
    const Model = await loadModel('Post')
    const prepared = prepareModelFields(Model, {
      focus_keyword: '',
      meta_description: null,
    }, true)

    expect(prepared).toEqual({
      data: {
        focusKeyword: null,
        metaDescription: null,
      },
      errors: {},
    })
  })
})
