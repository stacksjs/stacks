import { describe, expect, it } from 'bun:test'
import { DashboardApiError } from './dashboard-api'
import { changedModelFields, modelDeleteWarning, modelFieldError, modelWriteFailure, userInviteHref, modelRecordBackHref, modelRecordCreateHref, modelRecordEditHref, modelRecordFields, modelRecordHref, modelRecordListLabel, modelRecordSections, modelRecordTitle } from './dashboard-model-record'
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
  writeCapabilities: { create: true, update: true, destroy: true, invite: false },
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
  const user: ModelRecord = {
    modelName: 'User',
    tableName: 'users',
    row: { id: 13, uuid: null, name: 'Ava', email: 'ava@example.com', avatar: null, status: 'active', two_factor_enabled: 0, login_count: 4, team_id: 2, meta: { plan: 'pro' }, created_at: '2026-11-05T23:01:51.038Z', updated_at: null, email_verified_at: null },
    columns: [
      { name: 'id', label: 'ID', type: 'number' },
      { name: 'uuid', label: 'Uuid', type: 'text' },
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'email', label: 'Email', type: 'text' },
      { name: 'avatar', label: 'Avatar', type: 'text' },
      { name: 'status', label: 'Status', type: 'text' },
      { name: 'two_factor_enabled', label: 'Two Factor Enabled', type: 'boolean' },
      { name: 'login_count', label: 'Login Count', type: 'number' },
      { name: 'team_id', label: 'Team ID', type: 'number' },
      { name: 'meta', label: 'Meta', type: 'json' },
      { name: 'created_at', label: 'Created At', type: 'date' },
      { name: 'updated_at', label: 'Updated At', type: 'date' },
      { name: 'email_verified_at', label: 'Email Verified At', type: 'text' },
    ],
    updateColumns: [],
    writeCapabilities: { create: true, update: false, destroy: false, invite: false },
  }

  it('groups the fields into the cards of the page', () => {
    const sections = modelRecordSections(user)
    expect(sections.map(section => [section.id, section.title, section.columns])).toEqual([
      ['information', 'User Information', 1],
      ['details', 'User Details', 2],
      ['identifiers', 'Identifiers', 2],
      ['timestamps', 'Timestamps', 2],
    ])
    const names = Object.fromEntries(sections.map(section => [section.id, section.details.map(detail => detail.name)]))
    expect(names.information).toEqual(['name', 'email', 'avatar', 'meta'])
    expect(names.details).toEqual(['status', 'two_factor_enabled', 'login_count'])
    expect(names.identifiers).toEqual(['id', 'uuid', 'team_id'])
    expect(names.timestamps).toEqual(['created_at', 'updated_at', 'email_verified_at'])
  })

  it('reads each value as a person would, and says what is missing', () => {
    const by = Object.fromEntries(modelRecordSections(user).flatMap(section => section.details).map(detail => [detail.name, detail]))
    expect(by.avatar).toMatchObject({ value: 'No avatar', empty: true })
    expect(by.uuid).toMatchObject({ label: 'UUID', value: 'No UUID', empty: true })
    expect(by.status).toMatchObject({ value: 'Active', kind: 'badge' })
    expect(by.two_factor_enabled).toMatchObject({ value: 'No', kind: 'boolean', yes: false, empty: false })
    expect(by.meta).toMatchObject({ kind: 'json', wide: true })
    expect(by.meta!.value).toContain('"plan": "pro"')
    // A date reads as a date, and its label drops the "At".
    expect(by.created_at!.label).toBe('Created')
    expect(by.created_at!.value).not.toContain('T23:01')
    expect(by.created_at!.value).toContain('2026')
    expect(by.updated_at).toMatchObject({ label: 'Last Updated', value: 'Not yet', empty: true })
    expect(by.email_verified_at).toMatchObject({ label: 'Email Verified', value: 'Not yet', empty: true })
  })

  it('leaves out a card with nothing in it', () => {
    const sections = modelRecordSections({ ...user, columns: user.columns.filter(column => column.name === 'name') })
    expect(sections.map(section => section.id)).toEqual(['information'])
  })

  it('names the list in the breadcrumb', () => {
    expect(modelRecordListLabel(user, '/data/users')).toBe('Users')
    expect(modelRecordListLabel({ ...user, tableName: 'product_categories' }, '/models/product-category')).toBe('Product Categories')
    expect(modelRecordListLabel(null, '/models/user')).toBe('Records')
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

  it('links to the edit page, remembering where the visitor came from', () => {
    expect(modelRecordEditHref('team', 1)).toBe('/models/team/1/edit')
    expect(modelRecordEditHref('team', 1, { from: '/data/teams' })).toBe('/models/team/1/edit?from=%2Fdata%2Fteams')
    expect(modelRecordEditHref('team', 1, { from: '/data/teams', via: 'view' })).toBe('/models/team/1/edit?from=%2Fdata%2Fteams&via=view')
    expect(modelRecordEditHref('team', 1, { via: 'view' })).toBe('/models/team/1/edit?via=view')
  })

  it('never goes back to an address outside the dashboard', () => {
    for (const from of ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '/data/users?x=<script>'])
      expect(modelRecordBackHref('user', from)).toBe('/models/user')
  })
})

describe('creating a model record', () => {
  it('links to the create page, remembering the list to return to', () => {
    expect(modelRecordCreateHref('team')).toBe('/models/team/create')
    expect(modelRecordCreateHref('team', '/data/teams')).toBe('/models/team/create?from=%2Fdata%2Fteams')
  })

  it('reports a refusal in one shape, with each field\'s message under its field', () => {
    expect(modelWriteFailure(new DashboardApiError('Validation failed.', 422, { name: 'The name is required.' })))
      .toEqual({ ok: false, error: 'Check the field marked below.', errors: { name: ['The name is required.'] } })
    expect(modelWriteFailure(new DashboardApiError('Validation failed.', 422, { name: 'Too short.', email: 'Already in use.' })).error)
      .toBe('Check the 2 fields marked below.')
    expect(modelWriteFailure(new DashboardApiError('Server error', 500))).toEqual({ ok: false, error: 'Server error', errors: {} })
    expect(modelWriteFailure(new Error('offline'))).toEqual({ ok: false, error: 'offline', errors: {} })
  })
})

describe('a refused edit', () => {
  it('finds a field\'s message whichever way the field is spelled', () => {
    // The API names fields as the model does; an edit form's inputs are columns.
    const errors = { firstName: ['Too short.'], email: ['Already in use.'] }
    expect(modelFieldError(errors, 'first_name')).toBe('Too short.')
    expect(modelFieldError(errors, 'firstName')).toBe('Too short.')
    expect(modelFieldError(errors, 'email')).toBe('Already in use.')
    expect(modelFieldError(errors, 'avatar')).toBe('')
    expect(modelFieldError({}, 'email')).toBe('')
  })
})

describe('the delete confirmation', () => {
  it('says what happens in plain words', () => {
    expect(modelDeleteWarning('Ava')).toBe('Ava will be deleted. This cannot be undone from the dashboard.')
  })
})

describe('inviting a user', () => {
  it('links to the invite page, remembering the list to return to', () => {
    expect(userInviteHref()).toBe('/data/users/invite')
    expect(userInviteHref('/data/users')).toBe('/data/users/invite?from=%2Fdata%2Fusers')
    expect(userInviteHref('/models/user')).toBe('/data/users/invite?from=%2Fmodels%2Fuser')
  })
})
