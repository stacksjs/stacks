import type { FormDefinition, FormFieldDefinition } from '../src/types'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

const DB_PATH = join(tmpdir(), `stacks-forms-${process.pid}.sqlite`)
process.env.DB_CONNECTION = 'sqlite'
process.env.DB_DATABASE_PATH = DB_PATH
process.env.APP_ENV = 'testing'

const { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig } = await import('@stacksjs/database')
const { evaluateConditions, visibleFields } = await import('../src/conditions')
const { loadFormByUuid, publicDefinition } = await import('../src/definition')
const { createForm, loadFormByHandle } = await import('../src/create')

/** A site id for the scoped-form tests; nothing else in this file uses one. */
const SITE_ID = 91
const { completeSubmissionPayment, exportSubmissionsCsv, fetchSubmissions, submitForm } = await import('../src/submissions')
const { computeAmountCents, validateSubmission } = await import('../src/validate')

const releaseDbConfigLock = await acquireDbConfigLock()

async function forceConfig(): Promise<void> {
  await ensureDatabaseConfigLoaded()
  initializeDbConfig({
    app: { env: 'testing' },
    database: {
      default: 'sqlite',
      connections: { sqlite: { database: DB_PATH, prefix: '' } },
    },
  })
}

beforeAll(async () => {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${DB_PATH}${suffix}`))
      unlinkSync(`${DB_PATH}${suffix}`)
  }
  await forceConfig()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid VARCHAR(255) UNIQUE,
      site_id INTEGER,
      name VARCHAR(255) NOT NULL,
      handle VARCHAR(64) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'draft',
      settings TEXT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS form_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL,
      name VARCHAR(64) NOT NULL,
      label VARCHAR(255) NOT NULL,
      type VARCHAR(32) NOT NULL,
      required BOOLEAN DEFAULT 0,
      position INTEGER DEFAULT 0,
      width VARCHAR(8) DEFAULT 'full',
      options TEXT,
      conditions TEXT,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS form_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid VARCHAR(255) UNIQUE,
      form_id INTEGER NOT NULL,
      site_id INTEGER,
      data TEXT NOT NULL,
      email VARCHAR(255),
      name VARCHAR(255),
      status VARCHAR(32) NOT NULL DEFAULT 'complete',
      amount_cents INTEGER,
      payment_intent_id VARCHAR(255),
      ip VARCHAR(64),
      submitted_at TIMESTAMP,
      created_at TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()
})

beforeEach(async () => {
  await forceConfig()
  await db.unsafe('DELETE FROM form_submissions').execute()
  await db.unsafe('DELETE FROM form_fields').execute()
  await db.unsafe('DELETE FROM forms').execute()
})

afterAll(() => {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      if (existsSync(`${DB_PATH}${suffix}`))
        unlinkSync(`${DB_PATH}${suffix}`)
    }
    catch {
      // best effort
    }
  }
  releaseDbConfigLock()
})

function field(overrides: Partial<FormFieldDefinition> & { name: string, type: FormFieldDefinition['type'] }): FormFieldDefinition {
  return {
    label: overrides.name,
    required: false,
    position: 0,
    width: 'full',
    options: {},
    conditions: null,
    ...overrides,
  }
}

function inquiryForm(overrides: Partial<FormDefinition> = {}): FormDefinition {
  return {
    id: 1,
    uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    siteId: 1,
    name: 'Inquiry',
    handle: 'inquiry',
    status: 'active',
    settings: {},
    fields: [
      field({ name: 'parent_name', type: 'text', label: 'Parent name', required: true, position: 1 }),
      field({ name: 'email', type: 'email', label: 'Email', required: true, position: 2 }),
      field({ name: 'grade', type: 'select', label: 'Grade', position: 3, options: { choices: [{ label: 'K', value: 'k' }, { label: '1st', value: '1' }] } }),
      field({
        name: 'sibling_name',
        type: 'text',
        label: 'Sibling name',
        required: true,
        position: 4,
        conditions: { action: 'show', logic: 'all', rules: [{ field: 'has_sibling', op: 'eq', value: 'true' }] },
      }),
      field({ name: 'has_sibling', type: 'checkbox', label: 'Sibling?', position: 5 }),
    ],
    ...overrides,
  }
}

async function seedForm(form: FormDefinition): Promise<void> {
  await db.unsafe(`
    INSERT INTO forms (uuid, site_id, name, handle, status, settings, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `, [form.uuid, form.siteId, form.name, form.handle, form.status, JSON.stringify(form.settings)]).execute()

  const rows = await db.unsafe('SELECT id FROM forms WHERE uuid = ?', [form.uuid]).execute() as { id: number }[]
  form.id = Number(rows[0]!.id)

  for (const f of form.fields) {
    await db.unsafe(`
      INSERT INTO form_fields (form_id, name, label, type, required, position, width, options, conditions, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [form.id, f.name, f.label, f.type, f.required ? 1 : 0, f.position, f.width, JSON.stringify(f.options), f.conditions ? JSON.stringify(f.conditions) : null]).execute()
  }
}

describe('conditions', () => {
  test('show/hide with all/any logic', () => {
    const show = { action: 'show' as const, logic: 'all' as const, rules: [{ field: 'a', op: 'eq' as const, value: 'x' }, { field: 'b', op: 'not_empty' as const }] }
    expect(evaluateConditions(show, { a: 'x', b: 'y' })).toBe(true)
    expect(evaluateConditions(show, { a: 'x' })).toBe(false)

    const hideAny = { action: 'hide' as const, logic: 'any' as const, rules: [{ field: 'a', op: 'gt' as const, value: 5 }] }
    expect(evaluateConditions(hideAny, { a: 6 })).toBe(false)
    expect(evaluateConditions(hideAny, { a: 2 })).toBe(true)
  })

  test('no conditions means visible', () => {
    expect(evaluateConditions(null, {})).toBe(true)
    expect(visibleFields(inquiryForm().fields, {}).map(f => f.name)).not.toContain('sibling_name')
    expect(visibleFields(inquiryForm().fields, { has_sibling: 'true' }).map(f => f.name)).toContain('sibling_name')
  })
})

describe('validateSubmission', () => {
  test('accepts a valid submission and extracts email + name', () => {
    const result = validateSubmission(inquiryForm(), {
      parent_name: 'Dana Reyes',
      email: 'Dana@Example.com',
      grade: 'k',
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.email).toBe('dana@example.com')
      expect(result.name).toBe('Dana Reyes')
      expect(result.values.grade).toBe('k')
    }
  })

  test('a hidden required field is not required; its smuggled value is discarded', () => {
    const result = validateSubmission(inquiryForm(), {
      parent_name: 'Dana',
      email: 'dana@example.com',
      sibling_name: 'should not persist',
    })
    expect(result.ok).toBe(true)
    if (result.ok)
      expect(result.values.sibling_name).toBeUndefined()
  })

  test('a visible required field IS required', () => {
    const result = validateSubmission(inquiryForm(), {
      parent_name: 'Dana',
      email: 'dana@example.com',
      has_sibling: true,
    })
    expect(result.ok).toBe(false)
    if (!result.ok)
      expect(result.errors.sibling_name).toContain('required')
  })

  test('unknown fields are discarded; bad values are named', () => {
    const bad = validateSubmission(inquiryForm(), {
      parent_name: 'Dana',
      email: 'not-an-email',
      grade: 'not-a-choice',
      hacker_field: 'x',
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) {
      expect(Object.keys(bad.errors).sort()).toEqual(['email', 'grade'])
    }

    const good = validateSubmission(inquiryForm(), { parent_name: 'D', email: 'd@e.io', extra: 'x' })
    if (good.ok)
      expect(good.values.extra).toBeUndefined()
  })

  test('payment amounts are server-computed, never client totals', () => {
    const donation = inquiryForm({
      settings: { payment: { mode: 'user_amount', amountField: 'gift', minAmountCents: 500 } },
      fields: [
        field({ name: 'email', type: 'email', label: 'Email', required: true, position: 1 }),
        field({ name: 'gift', type: 'currency', label: 'Gift', required: true, position: 2 }),
      ],
    })
    const below = validateSubmission(donation, { email: 'd@e.io', gift: 100 })
    expect(below.ok).toBe(true)
    if (below.ok)
      expect(below.amountCents).toBe(500)

    const fixed = inquiryForm({ settings: { payment: { mode: 'fixed', amountCents: 2500 } } })
    expect(computeAmountCents(fixed, fixed.fields, {})).toBe(2500)

    const sum = inquiryForm({
      settings: { payment: { mode: 'field_sum' } },
      fields: [
        field({ name: 'tickets', type: 'currency', label: 'Tickets', position: 1 }),
        field({ name: 'donation', type: 'currency', label: 'Donation', position: 2 }),
      ],
    })
    expect(computeAmountCents(sum, sum.fields, { tickets: 5000, donation: 2500 })).toBe(7500)
  })
})

describe('submitForm', () => {
  test('stores a complete submission with typed columns', async () => {
    const form = inquiryForm()
    await seedForm(form)

    const result = await submitForm(form, { parent_name: 'Dana', email: 'dana@example.com', grade: '1' })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.status).toBe('complete')
      const rows = await fetchSubmissions(form.id)
      expect(rows).toHaveLength(1)
      expect(rows[0]!.email).toBe('dana@example.com')
      expect(rows[0]!.values.grade).toBe('1')
    }
  })

  test('inactive forms refuse; honeypot fakes success and stores nothing', async () => {
    const closed = inquiryForm({ status: 'closed' })
    await seedForm(closed)
    const refused = await submitForm(closed, { parent_name: 'D', email: 'd@e.io' })
    expect(refused.ok).toBe(false)

    const active = inquiryForm({ uuid: 'ffffffff-1111-2222-3333-444444444444', handle: 'other' })
    await seedForm(active)
    const bot = await submitForm(active, { parent_name: 'B', email: 'b@e.io' }, { honeypot: 'gotcha' })
    expect(bot.ok).toBe(true)
    expect(await fetchSubmissions(active.id)).toHaveLength(0)
  })

  test('payment forms park as pending_payment until the webhook completes them', async () => {
    const paid = inquiryForm({
      settings: { payment: { mode: 'fixed', amountCents: 2500 } },
    })
    await seedForm(paid)

    const result = await submitForm(paid, { parent_name: 'Dana', email: 'dana@example.com' })
    expect(result.ok).toBe(true)
    if (!result.ok)
      return

    expect(result.status).toBe('pending_payment')
    expect(result.amountCents).toBe(2500)

    expect(await completeSubmissionPayment(result.submissionUuid, 'pi_123')).toBe(true)
    // Second completion is a no-op - webhooks retry.
    expect(await completeSubmissionPayment(result.submissionUuid, 'pi_123')).toBe(false)

    const rows = await fetchSubmissions(paid.id)
    expect(rows[0]!.status).toBe('complete')
  })
})

describe('loadFormByUuid', () => {
  test('site scoping: another site cannot load the form', async () => {
    const form = inquiryForm()
    await seedForm(form)

    expect(await loadFormByUuid(form.uuid, 1)).not.toBeNull()
    expect(await loadFormByUuid(form.uuid, 2)).toBeNull()
    // Single-site apps pass null and match regardless.
    expect(await loadFormByUuid(form.uuid, null)).not.toBeNull()
  })

  test('publicDefinition hides notify addresses', async () => {
    const form = inquiryForm({ settings: { notifyEmails: ['admissions@school.org'], submitLabel: 'Send inquiry' } })
    const pub = publicDefinition(form)
    expect(JSON.stringify(pub)).not.toContain('admissions@school.org')
    expect(pub.submitLabel).toBe('Send inquiry')
  })
})

describe('exportSubmissionsCsv', () => {
  test('escapes spreadsheet formulas and quotes', async () => {
    const form = inquiryForm()
    await seedForm(form)
    await submitForm(form, { parent_name: '=HYPERLINK("evil")', email: 'x@e.io' })

    const csv = await exportSubmissionsCsv(form)
    expect(csv).toContain(`"'=HYPERLINK(""evil"")"`)
    expect(csv.split('\n')[0]).toContain('Parent name')
  })
})

describe('createForm', () => {
  test('creates a form with its fields, readable by handle', async () => {
    const created = await createForm(SITE_ID, {
      handle: 'admissions-enquiry',
      name: 'Admissions enquiry',
      status: 'active',
      settings: { submitLabel: 'Send enquiry', notifyEmails: ['admissions@school.test'] },
      fields: [
        { name: 'parent_name', label: 'Your name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
        { name: 'entry_year', label: 'Entry year', type: 'select', options: { choices: [{ value: '2027', label: '2027' }] } },
      ],
    })

    expect(created.created).toBe(true)

    const form = await loadFormByHandle(SITE_ID, 'admissions-enquiry')
    expect(form).toBeTruthy()
    expect(form!.name).toBe('Admissions enquiry')
    expect(form!.fields).toHaveLength(3)
    // Position is assigned in the order given, so the form renders as written.
    expect(form!.fields.map(field => field.name)).toEqual(['parent_name', 'email', 'entry_year'])
    expect(form!.fields[0]!.required).toBe(true)
  })

  test('is idempotent on the handle rather than making a second form', async () => {
    const first = await createForm(SITE_ID, {
      handle: 'repeat-me',
      name: 'First name',
      fields: [{ name: 'a', label: 'A', type: 'text' }],
    })

    const second = await createForm(SITE_ID, {
      handle: 'repeat-me',
      name: 'Renamed',
      fields: [{ name: 'a', label: 'A', type: 'text' }],
    })

    expect(second.created).toBe(false)
    expect(second.id).toBe(first.id)
    expect(second.uuid).toBe(first.uuid)

    const form = await loadFormByHandle(SITE_ID, 'repeat-me')
    expect(form!.name).toBe('Renamed')
  })

  test('replaces the fields, so a removed one does not linger', async () => {
    await createForm(SITE_ID, {
      handle: 'shrinking',
      name: 'Shrinking',
      fields: [
        { name: 'keep', label: 'Keep', type: 'text' },
        { name: 'drop', label: 'Drop', type: 'text' },
      ],
    })

    await createForm(SITE_ID, {
      handle: 'shrinking',
      name: 'Shrinking',
      fields: [{ name: 'keep', label: 'Keep', type: 'text' }],
    })

    const form = await loadFormByHandle(SITE_ID, 'shrinking')
    expect(form!.fields.map(field => field.name)).toEqual(['keep'])
  })

  test('a handle belongs to its site', async () => {
    await createForm(SITE_ID, { handle: 'scoped', name: 'Mine', fields: [{ name: 'a', label: 'A', type: 'text' }] })

    expect(await loadFormByHandle(SITE_ID, 'scoped')).toBeTruthy()
    expect(await loadFormByHandle(SITE_ID + 1, 'scoped')).toBeNull()
  })

  test('a submission validates against the created definition', async () => {
    await createForm(SITE_ID, {
      handle: 'validated',
      name: 'Validated',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email', required: true },
      ],
    })

    const form = (await loadFormByHandle(SITE_ID, 'validated'))!

    const missing = await validateSubmission(form, { name: 'Ada' })
    expect(missing.ok).toBe(false)

    const good = await validateSubmission(form, { name: 'Ada', email: 'ada@school.test' })
    expect(good.ok).toBe(true)
  })
})
