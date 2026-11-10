import { describe, expect, it } from 'bun:test'
import { changedModelFields, modelRecordBackHref, modelRecordDetails, modelRecordFields, modelRecordHref, modelRecordTitle } from './dashboard-model-record'
import type { ModelRecord } from './dashboard-model-record'

const record: ModelRecord = {
  modelName: 'Team',
  row: { id: 4, name: 'PrimeSoft Ltd', description: null, status: 'active', created_at: '2026-08-08' },
  columns: [
    { name: 'id', label: 'Id', type: 'number' },
    { name: 'name', label: 'Name', type: 'text' },
    { name: 'description', label: 'Description', type: 'text' },
    { name: 'status', label: 'Status', type: 'text' },
    { name: 'created_at', label: 'Created At', type: 'date' },
  ],
  updateColumns: ['name', 'description', 'status'],
  writeCapabilities: { create: true, update: true, destroy: true },
}

describe('a model record in the dashboard dialog', () => {
  it('lets the pencil change only the writable columns', () => {
    const fields = modelRecordFields(record)
    expect(fields.map(field => field.name)).toEqual(['id', 'name', 'description', 'status', 'created_at'])
    expect(fields.filter(field => !field.readonly).map(field => field.name)).toEqual(['name', 'description', 'status'])
    expect(fields.find(field => field.name === 'description')?.value).toBe('')
  })

  it('sends only what an edit changed, an emptied field as null', () => {
    expect(changedModelFields(record.row, { name: 'PrimeSoft Ltd', description: '', status: 'inactive' })).toEqual({ status: 'inactive' })
    expect(changedModelFields(record.row, { name: '', description: 'Cloud', status: 'active' })).toEqual({ name: null, description: 'Cloud' })
    expect(changedModelFields(record.row, { name: 'PrimeSoft Ltd' })).toEqual({})
  })
})

describe('a model record on its own page', () => {
  it('shows every column as a person reads it, and marks the empty ones', () => {
    const details = modelRecordDetails({ ...record, row: { ...record.row, active: 1, meta: { plan: 'pro' } }, columns: [...record.columns, { name: 'active', label: 'Active', type: 'boolean' }, { name: 'meta', label: 'Meta', type: 'json' }] })
    const by = Object.fromEntries(details.map(detail => [detail.name, detail]))
    expect(by.id).toMatchObject({ value: '4', empty: false })
    expect(by.description).toMatchObject({ value: '', empty: true })
    expect(by.active!.value).toBe('Yes')
    expect(by.meta).toMatchObject({ block: true })
    expect(by.meta!.value).toContain('"plan": "pro"')
    // A date reads as a date, not as the stored ISO text.
    expect(by.created_at!.value).not.toBe('2026-08-08')
    expect(by.created_at!.value).toContain('2026')
  })

  it('names the record by what it is called, else by its id', () => {
    expect(modelRecordTitle(record)).toBe('PrimeSoft Ltd')
    expect(modelRecordTitle({ ...record, row: { id: 9, email: 'ava@example.com' } })).toBe('ava@example.com')
    expect(modelRecordTitle({ ...record, row: { id: 9 } })).toBe('Team 9')
  })

  it('links to the page and back to the list it came from', () => {
    expect(modelRecordHref('user', 13)).toBe('/models/user/13')
    expect(modelRecordHref('user', 13, '/data/users')).toBe('/models/user/13?from=%2Fdata%2Fusers')
    expect(modelRecordBackHref('user', '/data/users')).toBe('/data/users')
    expect(modelRecordBackHref('user', null)).toBe('/models/user')
  })

  it('never goes back to an address outside the dashboard', () => {
    for (const from of ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '/data/users?x=<script>'])
      expect(modelRecordBackHref('user', from)).toBe('/models/user')
  })
})
