import { describe, expect, it } from 'bun:test'
import { DashboardApiError } from './dashboard-api'
import { modelDeleteNotice, modelDeleteWarning, modelFieldColumn, modelFieldError, modelFieldInputValue, modelFieldPayloadValue, modelFormPayload, modelFormValues, modelRecordBackHref, modelRecordCreateHref, modelRecordEditHref, modelRecordHref, modelRecordListLabel, modelRecordSections, modelRecordTitle, modelWriteFailure, userInviteHref } from './dashboard-model-record'
import type { ModelCreateField, ModelRecord } from './dashboard-model-record'

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
  fields: [],
  writeCapabilities: { create: true, update: true, destroy: true, invite: false, anonymize: false },
  anonymized: false,
}

const field = (name: string, type: ModelCreateField['type'], extra: Partial<ModelCreateField> = {}): ModelCreateField => ({ name, label: name, type, required: false, defaultValue: type === 'boolean' ? false : '', options: [], ...extra })

describe('what a form holds for a stored value', () => {
  it('finds a field in its column', () => {
    expect(modelFieldColumn('firstName')).toBe('first_name')
    expect(modelFieldColumn('published_at')).toBe('published_at')
    const values = modelFormValues([field('firstName', 'text'), field('status', 'enum')], { first_name: 'Ada', status: 'active' })
    expect(values).toEqual({ firstName: 'Ada', status: 'active' })
  })

  it('a checkbox is on or off, however the driver spelled yes', () => {
    for (const yes of [true, 1, '1', 'true'])
      expect(modelFieldInputValue(field('archived', 'boolean'), yes)).toBe(true)
    for (const no of [false, 0, '0', null, undefined, ''])
      expect(modelFieldInputValue(field('archived', 'boolean'), no)).toBe(false)
  })

  it('a date is its calendar day, never shifted by a time zone', () => {
    // A driver hands a DATE back as midnight UTC, which is the day before
    // for everyone west of it if it goes through `Date`.
    expect(modelFieldInputValue(field('opensAt', 'date'), '2026-10-01')).toBe('2026-10-01')
    expect(modelFieldInputValue(field('opensAt', 'date'), '2026-10-01T00:00:00.000Z')).toBe('2026-10-01')
    expect(modelFieldInputValue(field('opensAt', 'date'), new Date('2026-10-01T00:00:00.000Z'))).toBe('2026-10-01')
  })

  it('a moment is shown on the visitor\'s own clock, and comes back as the same instant', () => {
    const moment = field('scheduledAt', 'datetime')
    // Stored without an offset is UTC, as the framework writes it.
    for (const stored of ['2026-08-14 07:33:04', '2026-08-14T07:33:04.000Z', 1786692784]) {
      const shown = modelFieldInputValue(moment, stored) as string
      expect(shown).toMatch(/^2026-08-1[34]T\d{2}:33$/)
      // Whatever zone this runs in: the input's local time is that instant, to the minute.
      expect(new Date(shown).toISOString()).toBe('2026-08-14T07:33:00.000Z')
      expect(modelFieldPayloadValue(moment, shown)).toBe('2026-08-14T07:33:00.000Z')
    }
    expect(modelFieldInputValue(moment, null)).toBe('')
    expect(modelFieldInputValue(moment, 'not a date')).toBe('')
  })

  it('JSON is indented so it can be read, whether stored as text or as a value', () => {
    const json = field('settings', 'json')
    expect(modelFieldInputValue(json, '{"theme":"dark"}')).toBe('{\n  "theme": "dark"\n}')
    expect(modelFieldInputValue(json, { theme: 'dark' })).toBe('{\n  "theme": "dark"\n}')
    // Not JSON at all: shown as it is, for the visitor to repair.
    expect(modelFieldInputValue(json, '{theme')).toBe('{theme')
  })

  it('a create starts from each field\'s default', () => {
    expect(modelFormValues([field('status', 'enum', { defaultValue: 'draft' }), field('featured', 'boolean', { defaultValue: true }), field('title', 'text')]))
      .toEqual({ status: 'draft', featured: true, title: '' })
  })
})

describe('what a form sends', () => {
  const fields = [field('name', 'text'), field('description', 'longtext'), field('status', 'enum'), field('archived', 'boolean'), field('scheduledAt', 'datetime')]
  const row = { name: 'PrimeSoft Ltd', description: null, status: 'active', archived: 0, scheduled_at: '2026-08-14 07:33:04' }

  it('an edit sends only what was changed, an emptied field as null', () => {
    const initial = modelFormValues(fields, row)
    expect(modelFormPayload(fields, { ...initial }, initial)).toEqual({})
    expect(modelFormPayload(fields, { ...initial, status: 'inactive' }, initial)).toEqual({ status: 'inactive' })
    expect(modelFormPayload(fields, { ...initial, name: '', description: 'Cloud' }, initial)).toEqual({ name: null, description: 'Cloud' })
    expect(modelFormPayload(fields, { ...initial, archived: true }, initial)).toEqual({ archived: true })
    expect(modelFormPayload(fields, { ...initial, scheduledAt: '' }, initial)).toEqual({ scheduledAt: null })
  })

  it('a create sends every field, with no and empty said plainly', () => {
    expect(modelFormPayload(fields, modelFormValues(fields))).toEqual({ name: null, description: null, status: null, archived: false, scheduledAt: null })
  })

  it('a moment goes with its offset, so it is the one the visitor picked', () => {
    const picked = '2026-12-24T09:30'
    expect(modelFieldPayloadValue(field('scheduledAt', 'datetime'), picked)).toBe(new Date(picked).toISOString())
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
    fields: [],
    writeCapabilities: { create: true, update: false, destroy: false, invite: false, anonymize: false },
    anonymized: false,
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

  it('says beforehand that an account other records refer to is anonymized instead', () => {
    expect(modelDeleteWarning('Ava', true)).toBe('Ava will be deleted. This cannot be undone from the dashboard. If other records still refer to this account, it is anonymized instead: the name and email are removed, sign-in is revoked and those records are kept.')
    expect(modelDeleteWarning('Ava', false)).toBe(modelDeleteWarning('Ava'))
  })

  it('reports afterwards which of the two happened', () => {
    expect(modelDeleteNotice('User Ava', 'deleted')).toEqual({ title: 'User Ava deleted' })
    // The account is still in the list, so "deleted" would be contradicted by the page.
    expect(modelDeleteNotice('User Ava', 'anonymized')).toEqual({
      title: 'User Ava anonymized',
      detail: 'Other records still refer to this account, so it was kept with its name and email removed. It can no longer sign in.',
    })
  })
})

describe('inviting a user', () => {
  it('links to the invite page, remembering the list to return to', () => {
    expect(userInviteHref()).toBe('/data/users/invite')
    expect(userInviteHref('/data/users')).toBe('/data/users/invite?from=%2Fdata%2Fusers')
    expect(userInviteHref('/models/user')).toBe('/data/users/invite?from=%2Fmodels%2Fuser')
  })
})
