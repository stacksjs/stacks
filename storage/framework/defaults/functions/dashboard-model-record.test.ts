import { describe, expect, it } from 'bun:test'
import { changedModelFields, modelRecordFields } from './dashboard-model-record'
import type { ModelRecord } from './dashboard-model-record'

const record: ModelRecord = {
  modelName: 'Team',
  row: { id: 4, name: 'PrimeSoft Ltd', description: null, status: 'active', created_at: '2026-08-08' },
  columns: [
    { name: 'id', label: 'Id' },
    { name: 'name', label: 'Name' },
    { name: 'description', label: 'Description' },
    { name: 'status', label: 'Status' },
    { name: 'created_at', label: 'Created At' },
  ],
  updateColumns: ['name', 'description', 'status'],
  writeCapabilities: { create: true, update: true, destroy: true },
}

describe('a model record in the dashboard dialog', () => {
  it('shows every column read-only through the eye', () => {
    const fields = modelRecordFields(record, true)
    expect(fields.map(field => field.name)).toEqual(['id', 'name', 'description', 'status', 'created_at'])
    expect(fields.every(field => field.readonly)).toBe(true)
    expect(fields.find(field => field.name === 'description')?.value).toBe('')
  })

  it('lets the pencil change only the writable columns', () => {
    const writable = modelRecordFields(record, false).filter(field => !field.readonly).map(field => field.name)
    expect(writable).toEqual(['name', 'description', 'status'])
  })

  it('sends only what an edit changed, an emptied field as null', () => {
    expect(changedModelFields(record.row, { name: 'PrimeSoft Ltd', description: '', status: 'inactive' })).toEqual({ status: 'inactive' })
    expect(changedModelFields(record.row, { name: '', description: 'Cloud', status: 'active' })).toEqual({ name: null, description: 'Cloud' })
    expect(changedModelFields(record.row, { name: 'PrimeSoft Ltd' })).toEqual({})
  })
})
