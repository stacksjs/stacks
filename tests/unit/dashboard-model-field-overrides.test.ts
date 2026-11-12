import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { formatCurrency } from '@stacksjs/commerce/money'
import { schema } from '@stacksjs/validation'
import { loadModelRegistry } from '../../storage/framework/core/orm/src/model-registry'
import { modelFieldOverrides } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-fields'
import { relatedSummaryColumns } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-related'
import { duplicateFieldErrors, modelColumnDisplay, modelColumnLabel, modelCreateFields, modelFieldProblems, prepareModelFields } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'
import { modelByteSize, modelDuration, modelColumnIsDate, modelColumnIsNumeric, modelFormattedValue } from '../../storage/framework/defaults/functions/dashboard-model-format'
import { modelRecordSections } from '../../storage/framework/defaults/functions/dashboard-model-record'

/**
 * A model's say on how its fields are called, shown and asked for
 * (stacksjs/stacks#3266).
 *
 * An attribute says what a field is. It cannot say that `amount` is money
 * and `sizeBytes` is a size, or that `created_at` is called "Joined" here,
 * so headings read like field names and 83000 was shown as 83000.
 * `dashboard.fields` is where the model says so.
 */
const Order = () => ({
  name: 'Order',
  belongsTo: ['Customer'],
  attributes: {
    reference: { fillable: true, unique: true, validation: { rule: schema.string().required() } },
    notes: { fillable: true, validation: { rule: schema.string() } },
    contact: { fillable: true, validation: { rule: schema.string() } },
    totalAmount: { fillable: true, validation: { rule: schema.number() } },
    currency: { fillable: true, validation: { rule: schema.string() } },
    isGift: { fillable: true, validation: { rule: schema.boolean() } },
    shippedAt: { fillable: true, validation: { rule: schema.timestamp() } },
  },
  dashboard: {
    fields: {
      reference: { label: 'Order number' },
      notes: { input: 'longtext', help: 'Shown to the customer on their receipt.' },
      contact: { input: 'url' },
      totalAmount: { label: 'Total', format: 'money', currencyField: 'currency' },
      customer: { label: 'Buyer', help: 'Who is billed.' },
      shipped_at: { label: 'Dispatched' },
    } as Record<string, unknown>,
  },
})

describe('a model\'s field overrides, through the dashboard\'s actions', () => {
  it('reach the list, the form and a refused write', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-field-overrides-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/model-field-overrides.ts`], {
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'users.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('field overrides OK')
      }
      finally {
        clearTimeout(watchdog)
        child.kill()
      }
    }
    finally {
      await rm(directory, { recursive: true, force: true })
    }
  }, 60_000)
})

describe('reading what a model declares', () => {
  it('a model with none changes nothing', () => {
    expect(modelFieldOverrides({ name: 'Order' })).toEqual({ fields: {}, problems: [] })
    expect(modelFieldOverrides({ name: 'Order', dashboard: {} })).toEqual({ fields: {}, problems: [] })
    expect(modelFieldOverrides({ name: 'Order', dashboard: { fields: ['total'] } })).toEqual({ fields: {}, problems: ['dashboard.fields is not an object keyed by field name'] })
  })

  it('by the column, however the field was named', () => {
    const { fields, problems } = modelFieldOverrides(Order())
    expect(problems).toEqual([])
    expect(fields).toEqual({
      reference: { declared: 'reference', label: 'Order number' },
      notes: { declared: 'notes', input: 'longtext', help: 'Shown to the customer on their receipt.' },
      contact: { declared: 'contact', input: 'url' },
      // An attribute by its own name, read against its column.
      total_amount: { declared: 'totalAmount', label: 'Total', display: { format: 'money', currencyColumn: 'currency' } },
      // A belongsTo by the model it names.
      customer_id: { declared: 'customer', label: 'Buyer', help: 'Who is billed.' },
      // A column by its own name.
      shipped_at: { declared: 'shipped_at', label: 'Dispatched' },
    })
  })

  it('reads what a format needs with it', () => {
    const { fields, problems } = modelFieldOverrides({ dashboard: { fields: {
      price: { format: 'money', currency: 'eur' },
      elapsed: { format: 'duration', unit: 's' },
      size: { format: 'bytes' },
    } } })
    expect(problems).toEqual([])
    expect(fields.price?.display).toEqual({ format: 'money', currency: 'EUR' })
    expect(fields.elapsed?.display).toEqual({ format: 'duration', unit: 's' })
    expect(fields.size?.display).toEqual({ format: 'bytes' })
  })

  it('drops a setting it cannot read on its own, and says which and why', () => {
    const { fields, problems } = modelFieldOverrides({ dashboard: { fields: {
      price: { label: 'Price', format: 'cash' },
      body: { input: 'richtext', help: 'Markdown.' },
      total: { format: 'money', currency: 'dollars' },
      weight: { format: 'number', currency: 'USD', unit: 'kg', currencyField: 'currency' },
      elapsed: { format: 'duration', unit: 'minutes' },
      title: { label: '  ', help: 7 },
      status: 'badge',
    } } })
    // A misspelled format does not cost the field its heading.
    expect(fields.price).toEqual({ declared: 'price', label: 'Price' })
    expect(fields.body).toEqual({ declared: 'body', help: 'Markdown.' })
    expect(fields.total?.display).toEqual({ format: 'money' })
    expect(fields.weight?.display).toEqual({ format: 'number' })
    expect(fields.elapsed?.display).toEqual({ format: 'duration' })
    expect(fields.status).toBeUndefined()
    expect(problems).toEqual([
      '\'price\' asks for a format the dashboard does not have: \'cash\' (it has badge, bytes, code, date, datetime, duration, image, link, money, number, percent, text)',
      '\'body\' asks for an input the dashboard does not have: \'richtext\' (it has email, longtext, text, url)',
      '\'total\' names a currency that is not a three-letter code: \'dollars\'',
      '\'weight\' names a currency, which only `format: \'money\'` reads',
      '\'weight\' names a currency field, which only `format: \'money\'` reads',
      '\'weight\' names a unit, which only `format: \'duration\'` reads',
      '\'elapsed\' names a unit that is not \'ms\' or \'s\': \'minutes\'',
      '\'title\' has a label that is not text',
      '\'title\' has help that is not text',
      '\'status\' is not an object of settings',
    ])
  })
})

describe('what a field is called', () => {
  it('the model\'s own word, on whichever spelling it is asked by', () => {
    const model = Order()
    expect(modelColumnLabel(model, 'reference')).toBe('Order number')
    expect(modelColumnLabel(model, 'totalAmount')).toBe('Total')
    expect(modelColumnLabel(model, 'total_amount')).toBe('Total')
    expect(modelColumnLabel(model, 'shippedAt')).toBe('Dispatched')
    // Its word for a relation wins over the related model's name.
    expect(modelColumnLabel(model, 'customer_id', 'Customer')).toBe('Buyer')
  })

  it('else the record it points at, else the name in words', () => {
    const plain = { name: 'Order', attributes: {} }
    expect(modelColumnLabel(plain, 'team_id', 'Team')).toBe('Team')
    expect(modelColumnLabel(plain, 'team_id')).toBe('Team ID')
    expect(modelColumnLabel(plain, 'imageUrl')).toBe('Image URL')
    expect(modelColumnLabel(plain, 'statusCode')).toBe('Status Code')
  })

  it('a moment reads as what happened, the same in a list as on the record', () => {
    const plain = { name: 'Order', attributes: {} }
    expect(modelColumnLabel(plain, 'created_at')).toBe('Created')
    expect(modelColumnLabel(plain, 'emailVerifiedAt')).toBe('Email Verified')
    expect(modelColumnLabel(plain, 'published_on')).toBe('Published')
    expect(modelColumnLabel(plain, 'updated_at')).toBe('Last Updated')
    // Only a moment: "At" is not stripped from a word that merely ends in it.
    expect(modelColumnLabel(plain, 'format')).toBe('Format')
  })

  it('the form asks under the same name, with the model\'s help and input', () => {
    const fields = Object.fromEntries(modelCreateFields(Order()).map(field => [field.name, field]))
    expect(fields.reference).toMatchObject({ label: 'Order number', type: 'text' })
    expect(fields.notes).toMatchObject({ label: 'Notes', type: 'longtext', help: 'Shown to the customer on their receipt.' })
    expect(fields.contact).toMatchObject({ type: 'url' })
    expect(fields.totalAmount).toMatchObject({ label: 'Total', type: 'number' })
    expect(fields.shippedAt).toMatchObject({ label: 'Dispatched', type: 'datetime' })
    expect(fields.customerId).toMatchObject({ label: 'Buyer', type: 'relation', help: 'Who is billed.', relation: { model: 'Customer', slug: 'customer', label: 'Customer' } })
    expect('help' in fields.reference!).toBe(false)
  })

  it('a refusal names the field as the form does', () => {
    const model = Order()
    expect(prepareModelFields(model, {}).errors).toEqual({ reference: ['Order number is required.'] })
    expect(duplicateFieldErrors(model, ['reference'])).toEqual({ reference: ['Order number is already in use.'] })
  })

  it('another input is only ever another way to type text', () => {
    const model = Order()
    model.dashboard.fields = { totalAmount: { input: 'longtext' }, isGift: { input: 'text' }, shippedAt: { input: 'text' }, customer: { input: 'text' }, missing: { label: 'Nope' }, reference: { format: 'money', currencyField: 'curency' } }
    const fields = Object.fromEntries(modelCreateFields(model).map(field => [field.name, field.type]))
    // What a value is stays the rule's to say: a number is not asked for as prose.
    expect(fields).toMatchObject({ totalAmount: 'number', isGift: 'boolean', shippedAt: 'datetime', customerId: 'relation' })
    expect(modelFieldProblems(model)).toEqual([
      '\'totalAmount\' asks for the \'longtext\' input, but it is not a field of text (it is asked for as number)',
      '\'isGift\' asks for the \'text\' input, but it is not a field of text (it is asked for as boolean)',
      '\'shippedAt\' asks for the \'text\' input, but it is not a field of text (it is asked for as datetime)',
      '\'customer\' asks for the \'text\' input, but it is not an attribute the forms ask for',
      '\'missing\' is not a field of the model',
      '\'reference\' names \'curency\' as its currency field, which the model does not have',
    ])
    // A column the table is seen to have, which the definition does not list.
    expect(modelFieldProblems({ name: 'User', attributes: {}, dashboard: { fields: { emailVerifiedAt: { label: 'Verified' } } } })).toEqual(['\'emailVerifiedAt\' is not a field of the model'])
    expect(modelFieldProblems({ name: 'User', attributes: {}, dashboard: { fields: { emailVerifiedAt: { label: 'Verified' } } } }, ['email_verified_at'])).toEqual([])
  })

  it('a panel on another record\'s page calls and shows it the same way', () => {
    const Line = {
      name: 'OrderLine',
      belongsTo: ['Order', 'Product'],
      attributes: { quantity: { validation: { rule: schema.number() } }, unitPrice: { validation: { rule: schema.number() } } },
      dashboard: { columns: ['product', 'quantity', 'unitPrice', 'createdAt'], fields: { product: { label: 'Item' }, unitPrice: { label: 'Each', format: 'money', currency: 'EUR' }, createdAt: { label: 'Added' } } },
    }
    expect(relatedSummaryColumns(Line, 'order_id', new Set(['Product']))).toEqual([
      { key: 'product_id', label: 'Item', type: 'text', relation: 'Product' },
      { key: 'quantity', label: 'Quantity', type: 'text' },
      { key: 'unit_price', label: 'Each', type: 'text', format: { format: 'money', currency: 'EUR' } },
      { key: 'created_at', label: 'Added', type: 'datetime' },
    ])
    expect(modelColumnDisplay(Line, 'unitPrice')).toEqual({ format: 'money', currency: 'EUR' })
    expect(modelColumnDisplay(Line, 'quantity')).toBeUndefined()
  })
})

describe('how a stored value reads', () => {
  const text = (value: unknown, display: Parameters<typeof modelFormattedValue>[1], row: Record<string, unknown> = {}) => modelFormattedValue(value, display, row)?.text

  it('nothing stored is the page\'s to word', () => {
    for (const value of [null, undefined, ''])
      expect(modelFormattedValue(value, { format: 'money' })).toBeNull()
    // Zero is a value.
    expect(text(0, { format: 'number' })).toBe('0')
  })

  it('money is minor units, in the row\'s own currency when it has one', () => {
    expect(text(1200, { format: 'money' })).toBe(formatCurrency(1200, 'USD'))
    expect(text(1200, { format: 'money' })).toContain('12.00')
    expect(text('1999', { format: 'money', currency: 'EUR' })).toBe(formatCurrency(1999, 'EUR'))
    expect(text(1999, { format: 'money', currency: 'EUR', currencyColumn: 'currency' }, { currency: 'JPY' })).toBe(formatCurrency(1999, 'JPY'))
    expect(text(1999, { format: 'money', currency: 'EUR', currencyColumn: 'currency' }, { currency: '' })).toBe(formatCurrency(1999, 'EUR'))
  })

  it('a number, a share, a size', () => {
    expect(text(12500, { format: 'number' })).toBe((12500).toLocaleString())
    expect(text(42.5, { format: 'percent' })).toBe('42.5%')
    expect(text('7', { format: 'percent' })).toBe('7%')
    expect(text(1536, { format: 'bytes' })).toBe('1.5 KB')
    expect(modelByteSize(0)).toBe('0 B')
    expect(modelByteSize(1023)).toBe('1,023 B')
    expect(modelByteSize(1024)).toBe('1 KB')
    expect(modelByteSize(5 * 1024 * 1024)).toBe('5 MB')
    // Never "1,024 KB": that is 1 MB.
    expect(modelByteSize(1024 * 1024 - 1)).toBe('1 MB')
    expect(modelByteSize(3.2 * 1024 ** 3)).toBe('3.2 GB')
  })

  it('a length of time, in the unit it was stored in', () => {
    expect(modelDuration(0.42)).toBe('0.42 ms')
    expect(modelDuration(634)).toBe('634 ms')
    expect(modelDuration(1250)).toBe('1.3 s')
    expect(modelDuration(83_000)).toBe('1 min 23 s')
    expect(modelDuration(120_000)).toBe('2 min')
    expect(modelDuration(82, 's')).toBe('1 min 22 s')
    expect(modelDuration(7_500, 's')).toBe('2 h 5 min')
    expect(modelDuration(90_000, 's')).toBe('1 d 1 h')
    // Rounded once, so a part never reads "60 s".
    expect(modelDuration(119_600)).toBe('2 min')
    expect(modelDuration(59_960)).toBe('1 min')
    expect(text(82, { format: 'duration', unit: 's' })).toBe('1 min 22 s')
    expect(text(82, { format: 'duration' })).toBe('82 ms')
  })

  it('a day and a moment', () => {
    const day = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
    const moment = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    // A calendar day stays the day it names, in any zone.
    expect(text('2026-10-01', { format: 'date' })).toBe(day.format(new Date(2026, 9, 1)))
    expect(text('2026-10-01 14:30:00', { format: 'datetime' })).toBe(moment.format(new Date('2026-10-01T14:30:00Z')))
    expect(text(1_790_000_000, { format: 'datetime' })).toBe(moment.format(new Date(1_790_000_000_000)))
    expect(text('not a date', { format: 'date' })).toBe('not a date')
  })

  it('a pill, a link out, a picture, a code font', () => {
    expect(modelFormattedValue('in_review', { format: 'badge' })).toEqual({ kind: 'badge', text: 'In Review' })
    expect(modelFormattedValue('https://example.com/pricing/', { format: 'link' })).toEqual({ kind: 'link', text: 'example.com/pricing', href: 'https://example.com/pricing/' })
    expect(modelFormattedValue('ava@example.com', { format: 'link' })).toEqual({ kind: 'link', text: 'ava@example.com', href: 'mailto:ava@example.com' })
    expect(modelFormattedValue('https://example.com/a.png', { format: 'image' })).toEqual({ kind: 'image', text: 'https://example.com/a.png', href: 'https://example.com/a.png' })
    expect(modelFormattedValue('/storage/avatars/7.png', { format: 'image' })).toEqual({ kind: 'image', text: '/storage/avatars/7.png', href: '/storage/avatars/7.png' })
    expect(modelFormattedValue('SELECT 1', { format: 'code' })).toEqual({ kind: 'code', text: 'SELECT 1' })
    expect(modelFormattedValue('Paid', { format: 'text' })).toEqual({ kind: 'text', text: 'Paid' })
  })

  it('never leads anywhere but a web or mail address', () => {
    for (const stored of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//example.com', 'example.com', 'ftp://example.com/x'])
      expect(modelFormattedValue(stored, { format: 'link' })).toEqual({ kind: 'text', text: stored })
    for (const stored of ['javascript:alert(1)', 'data:image/svg+xml,<svg onload=alert(1)>', '//example.com/a.png', 'a.png'])
      expect(modelFormattedValue(stored, { format: 'image' })).toEqual({ kind: 'text', text: stored })
  })

  it('a value the format cannot read is shown as stored, not as a number it is not', () => {
    for (const format of ['money', 'number', 'percent', 'bytes', 'duration'] as const)
      expect(modelFormattedValue('n/a', { format })).toEqual({ kind: 'text', text: 'n/a' })
    expect(modelFormattedValue({ a: 1 }, { format: 'code' })).toEqual({ kind: 'code', text: '{"a":1}' })
  })

  it('an amount lines up on the right, and the model\'s say comes before the column\'s name', () => {
    expect(modelColumnIsNumeric({ type: 'number' })).toBe(true)
    expect(modelColumnIsNumeric({ type: 'text', format: { format: 'money' } })).toBe(true)
    expect(modelColumnIsNumeric({ type: 'number', format: { format: 'code' } })).toBe(false)
    expect(modelColumnIsDate({ name: 'created_at' })).toBe(true)
    expect(modelColumnIsDate({ name: 'birthday', format: { format: 'date' } })).toBe(true)
    expect(modelColumnIsDate({ name: 'starts_at', format: { format: 'text' } })).toBe(false)
  })
})

describe('the record\'s page', () => {
  it('shows a field the way the model says, under the name the list gave it', () => {
    const sections = modelRecordSections({
      modelName: 'Deployment',
      row: { id: 4, commit_message: 'Ship it', duration: 82, url: 'https://app.example.com', size_bytes: null, status: 'live', logo: '/logo.png', sha: 'a1b2c3' },
      columns: [
        { name: 'id', label: 'ID', type: 'number' },
        { name: 'commit_message', label: 'Commit Message', type: 'text' },
        { name: 'duration', label: 'Duration', type: 'number', format: { format: 'duration', unit: 's' } },
        { name: 'url', label: 'URL', type: 'text', format: { format: 'link' } },
        { name: 'size_bytes', label: 'Size', type: 'number', format: { format: 'bytes' } },
        { name: 'status', label: 'State', type: 'text', format: { format: 'text' } },
        { name: 'logo', label: 'Logo', type: 'text', format: { format: 'image' } },
        { name: 'sha', label: 'Commit', type: 'text', format: { format: 'code' } },
      ],
      updateColumns: [],
      fields: [],
      relations: {},
      relationNames: {},
      writeCapabilities: { create: false, update: false, destroy: false, invite: false, anonymize: false },
      anonymized: false,
      actions: [],
    })
    const details = Object.fromEntries(sections.flatMap(section => section.details).map(detail => [detail.name, detail]))
    expect(details.duration).toMatchObject({ label: 'Duration', value: '1 min 22 s', kind: 'text', empty: false })
    expect(details.url).toMatchObject({ label: 'URL', value: 'app.example.com', kind: 'external', href: 'https://app.example.com' })
    expect(details.size_bytes).toMatchObject({ label: 'Size', value: 'No size', empty: true })
    // `text` keeps a status the dashboard would have drawn as a pill plain.
    expect(details.status).toMatchObject({ label: 'State', value: 'live', kind: 'text' })
    expect(details.logo).toMatchObject({ kind: 'image', href: '/logo.png' })
    expect(details.sha).toMatchObject({ kind: 'code', value: 'a1b2c3' })
    expect(details.commit_message).toMatchObject({ label: 'Commit Message', value: 'Ship it', kind: 'text' })
  })
})

describe('the fields the shipped models describe', () => {
  // Columns a trait adds to the table that the model's own definition does not list.
  const TRAIT_COLUMNS: Record<string, string[]> = { User: ['email_verified_at'] }

  it('every one names a real field and asks for something the dashboard has', async () => {
    const models = await loadModelRegistry({
      defaultsRoot: resolve('storage/framework/defaults/app/Models'),
      userRoot: join(tmpdir(), 'stacks-no-user-models'),
    }) as Record<string, any>
    const described = Object.entries(models).filter(([, model]) => model?.dashboard?.fields)
    const wrong = described.flatMap(([name, model]) => modelFieldProblems(model, TRAIT_COLUMNS[name]).map(problem => `${name}: ${problem}`))
    expect(wrong).toEqual([])
    // The ones whose stored unit is certain. A model added here by mistake
    // with nothing declared would pass the check above without being read.
    expect(described.map(([name]) => name).sort()).toEqual(['CardAttachment', 'Deployment', 'QueryLog', 'Request', 'User'])
    expect(modelColumnDisplay(models.Deployment, 'duration')).toEqual({ format: 'duration', unit: 's' })
    expect(modelColumnDisplay(models.Request, 'duration_ms')).toEqual({ format: 'duration' })
    expect(modelColumnLabel(models.Request, 'duration_ms')).toBe('Duration')
    expect(modelColumnLabel(models.CardAttachment, 'size_bytes')).toBe('Size')
  })
})

// Driven in a browser against the running dashboard; these pin what that run
// relied on.
describe('the pages', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard/Models'
  const read = async (path: string) => (await import('node:fs')).readFileSync(path, 'utf8')

  it('the list draws a cell as its format says, and lines amounts up on the right', async () => {
    const list = await read(`${components}/ModelRecordsDashboard.stx`)
    expect(list).toContain('return column.format ? modelFormattedValue(row[column.name], column.format, row) : null')
    expect(list).toContain('const align = modelColumnIsNumeric(column) ? \'text-right tabular-nums\' : \'text-left\'')
    expect(list).toContain('<a :if="cellKind(row, column) === \'link\'" :href="cellHref(row, column)" target="_blank" rel="noopener noreferrer"')
    expect(list).toContain('<img :if="cellKind(row, column) === \'image\'" :src="cellHref(row, column)" alt="" loading="lazy"')
    expect(list).toContain('<code :if="cellKind(row, column) === \'code\'"')
  })

  it('the record\'s page draws a link out, a picture and a code font', async () => {
    const page = await read(`${components}/ModelRecordDetail.stx`)
    expect(page).toContain('<a :if="detail.kind === \'external\'" :href="detail.href" target="_blank" rel="noopener noreferrer"')
    expect(page).toContain('<img :src="detail.href" :alt="detail.label" loading="lazy"')
    expect(page).toContain('<code :if="detail.kind === \'code\'"')
  })

  it('a panel hands the table what it can word and words the rest itself', async () => {
    const panels = await read(`${components}/ModelRelatedPanels.stx`)
    expect(panels).toContain('const TABLE_TYPES: Record<string, \'badge\' | \'currency\' | \'date\' | \'datetime\' | \'number\'> = { badge: \'badge\', date: \'date\', datetime: \'datetime\', money: \'currency\', number: \'number\' }')
    expect(panels).toContain(':data="tableRows(panel)"')
    expect(panels).toContain('shown[column.key] = modelFormattedValue(row[column.key], column.format!, row)?.text ?? \'\'')
  })

  it('every kind of input can carry the model\'s help', async () => {
    const inputs = await read(`${components}/ModelFieldInputs.stx`)
    expect(inputs).toContain('return [field.help, kind].filter(Boolean).join(\' \')')
    // The select, the relation picker, the text box, the line and the checkbox.
    expect((inputs.match(/:hint="hint\(field\)"/g) || []).length).toBe(4)
    expect(inputs).toContain('<span :if="hint(field) && !error(field)"')
    expect(inputs).toContain('field.type === \'url\'')
    expect(await read(`${components}/ModelRelationPicker.stx`)).toContain('<p :if="!error() && hint()"')
  })
})
