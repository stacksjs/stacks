import { describe, expect, it } from 'bun:test'
import type { ModelDrafts } from './dashboard-model-drafts'
import { modelDraftChangeCount, modelDraftKey, modelDraftListRows, modelDraftPut, modelDraftRemove, modelDraftRestore, modelDraftRowLabel, modelDraftValues, modelRelatedSaveChanges, saveModelRecordWithRelated } from './dashboard-model-drafts'
import type { ModelRelatedPanel } from './dashboard-model-record'

// An order's lines: the panel a record's edit page shows, as the API sends it.
const lines: ModelRelatedPanel = {
  kind: 'many',
  model: 'OrderLine',
  slug: 'order-line',
  title: 'Order Lines',
  label: 'Order Line',
  foreignKey: 'order_id',
  field: 'orderId',
  total: 2,
  columns: [{ key: 'sku', label: 'SKU', type: 'text' }, { key: 'unit_price', label: 'Unit Price', type: 'text' }],
  rows: [{ id: 10, sku: 'A-1', unit_price: 5 }, { id: 11, sku: 'B-2', unit_price: 9 }],
  canCreate: true,
  canUpdate: true,
  canDestroy: true,
  fields: [
    { name: 'sku', label: 'SKU', type: 'text', required: true },
    { name: 'unitPrice', label: 'Unit Price', type: 'number', required: false },
  ] as never,
  values: { 10: { sku: 'A-1', unit_price: 5 }, 11: { sku: 'B-2', unit_price: 9 } },
}

describe('a record\'s related rows, changed on its edit page', () => {
  it('sends nothing for rows that were only looked at, or edited back to what they were', () => {
    let drafts: ModelDrafts = {}
    expect(modelRelatedSaveChanges([lines], drafts)).toEqual([])
    drafts = modelDraftPut(drafts, lines, '10', { ...modelDraftValues(lines, drafts, '10') })
    expect(modelRelatedSaveChanges([lines], drafts)).toEqual([])
    expect(modelDraftChangeCount([lines], drafts)).toBe(0)
    expect(modelDraftListRows(lines, drafts).map(row => row.state)).toEqual(['kept', 'kept'])
  })

  it('sends only the fields an edit changed', () => {
    const start = modelDraftValues(lines, {}, '10')
    const drafts = modelDraftPut({}, lines, '10', { ...start, unitPrice: '7' })
    // As the form sends any field: text, which the server reads as its column's type.
    expect(modelRelatedSaveChanges([lines], drafts)).toEqual([{ slug: 'order-line', create: [], update: [{ id: 10, fields: { unitPrice: '7' } }], destroy: [] }])
    const listed = modelDraftListRows(lines, drafts)
    expect(listed[0]).toMatchObject({ key: '10', state: 'edited' })
    // Shown with the value it will be saved with, under the panel's column.
    expect(listed[0]!.values.unit_price).toBe('7')
  })

  it('adds rows under their own keys, and an added row edited again is one row', () => {
    let drafts: ModelDrafts = {}
    const first = modelDraftKey(drafts, 'order-line')
    drafts = modelDraftPut(drafts, lines, first, { sku: 'C-3', unitPrice: '2' })
    const second = modelDraftKey(drafts, 'order-line')
    expect(second).not.toBe(first)
    drafts = modelDraftPut(drafts, lines, second, { sku: 'D-4', unitPrice: '' })
    drafts = modelDraftPut(drafts, lines, first, { sku: 'C-3b', unitPrice: '2' })
    expect(modelRelatedSaveChanges([lines], drafts)[0]!.create).toEqual([
      { key: first, fields: { sku: 'C-3b', unitPrice: '2' } },
      { key: second, fields: { sku: 'D-4', unitPrice: null } },
    ])
    expect(modelDraftListRows(lines, drafts).map(row => [row.key, row.state])).toEqual([['10', 'kept'], ['11', 'kept'], [first, 'added'], [second, 'added']])
  })

  it('deletes a listed row and forgets its edit; a row added here is just dropped', () => {
    let drafts = modelDraftPut({}, lines, '11', { sku: 'B-2', unitPrice: '1' })
    drafts = modelDraftRemove(drafts, lines, '11')
    const added = modelDraftKey(drafts, 'order-line')
    drafts = modelDraftPut(drafts, lines, added, { sku: 'E-5', unitPrice: '3' })
    drafts = modelDraftRemove(drafts, lines, added)
    expect(modelRelatedSaveChanges([lines], drafts)).toEqual([{ slug: 'order-line', create: [], update: [], destroy: [11] }])
    expect(modelDraftListRows(lines, drafts).map(row => row.state)).toEqual(['kept', 'removed'])
    drafts = modelDraftRestore(drafts, lines, '11')
    expect(modelRelatedSaveChanges([lines], drafts)).toEqual([])
  })

  it('names a row by its summary values, or by what it is', () => {
    const [first] = modelDraftListRows(lines, {})
    expect(modelDraftRowLabel(lines, first!)).toBe('A-1 · 5')
    expect(modelDraftRowLabel(lines, { key: 'new-1', state: 'added', values: {} })).toBe('New order line')
    expect(modelDraftRowLabel(lines, { key: '12', state: 'kept', values: {} })).toBe('Order Line #12')
  })
})

describe('saving them with the record', () => {
  async function withFetch<T>(answer: Response, run: (asked: Request[]) => Promise<T>): Promise<T> {
    const original = globalThis.fetch
    const asked: Request[] = []
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      asked.push(new Request(new URL(String(input), 'http://dashboard.test'), init))
      return answer
    }) as typeof fetch
    try {
      return await run(asked)
    }
    finally {
      globalThis.fetch = original
    }
  }

  it('sends the record\'s fields and the panels\' changes in one request', async () => {
    const related = [{ slug: 'order-line', create: [], update: [], destroy: [11] }]
    const result = await withFetch(Response.json({ ok: true }), async (asked) => {
      const saved = await saveModelRecordWithRelated('order', 3, { status: 'paid' }, related)
      expect(asked).toHaveLength(1)
      expect(asked[0]!.method).toBe('PATCH')
      expect(new URL(asked[0]!.url).pathname).toBe('/api/dashboard/models/order/3/save')
      expect(await asked[0]!.json()).toEqual({ fields: { status: 'paid' }, related })
      return saved
    })
    expect(result).toEqual({ ok: true })
  })

  it('says where a refusal was, so the page can point at the row', async () => {
    const refusal = Response.json({ message: 'Validation failed.', errors: { unitPrice: ['Unit Price must be at least 1.'] }, at: { operation: 'create', panel: 'order-line', row: 'new-2' } }, { status: 422 })
    const result = await withFetch(refusal, () => saveModelRecordWithRelated('order', 3, {}, [{ slug: 'order-line', create: [{ key: 'new-2', fields: { unitPrice: 0 } }], update: [], destroy: [] }]))
    expect(result.ok).toBe(false)
    if (result.ok)
      return
    expect(result.at).toEqual({ operation: 'create', panel: 'order-line', row: 'new-2' })
    expect(result.errors).toEqual({ unitPrice: ['Unit Price must be at least 1.'] })
  })
})
