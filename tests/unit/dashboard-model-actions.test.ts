import { describe, expect, it } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { modelActionApplies, modelActionDefinitions, modelActionLabel, modelActionOutcome, modelActions, publicModelAction } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-actions'

/**
 * A model's own dashboard actions (stacksjs/stacks#3265).
 *
 * The dashboard derived a model's pages from its definition and had nothing
 * between that and replacing a page: no way to add a button that does
 * something. A model now names its actions under `dashboard.actions`, each
 * pointing at an action under `app/Actions`, and the dashboard draws the
 * button and runs the action as its own route would.
 */
const model = (actions: unknown) => ({ name: 'Order', dashboard: { actions } })
const ship = { name: 'ship', action: 'Actions/Orders/ShipOrderAction' }

describe('a model\'s dashboard actions, through a real server', () => {
  it('offers each row what applies and runs the action as its own route would', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-model-actions-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/model-actions.ts`], {
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'users.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('model actions OK')
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
  it('a model with none offers none', () => {
    expect(modelActionDefinitions({ name: 'Order' })).toEqual({ actions: [], problems: [] })
    expect(modelActionDefinitions({ name: 'Order', dashboard: {} })).toEqual({ actions: [], problems: [] })
    expect(modelActionDefinitions(model('ship'))).toEqual({ actions: [], problems: ['dashboard.actions is not a list'] })
  })

  it('fills in what a declaration leaves out', () => {
    expect(modelActionDefinitions(model([ship])).actions).toEqual([{
      name: 'ship',
      label: 'Ship',
      icon: '',
      confirm: '',
      destructive: false,
      places: ['record', 'row'],
      fields: [],
      handler: 'Actions/Orders/ShipOrderAction',
      when: [],
      asking: {},
    }])
  })

  it('keeps what it says', () => {
    const [action] = modelActionDefinitions(model([{
      ...ship,
      action: 'Actions/Orders/ShipOrderAction.ts',
      label: '  Mark as shipped ',
      icon: 'i-hugeicons-truck-delivery',
      confirm: 'The customer is emailed a tracking link.',
      destructive: true,
      on: ['row'],
      when: { status: ['paid', 'packed'], shippedAt: null, isGift: false, weight: 2 },
    }])).actions
    expect(action).toEqual({
      name: 'ship',
      label: 'Mark as shipped',
      icon: 'i-hugeicons-truck-delivery',
      confirm: 'The customer is emailed a tracking link.',
      destructive: true,
      places: ['row'],
      fields: [],
      asking: {},
      handler: 'Actions/Orders/ShipOrderAction',
      when: [
        { column: 'status', values: ['paid', 'packed'] },
        { column: 'shipped_at', values: [null] },
        { column: 'is_gift', values: [false] },
        { column: 'weight', values: [2] },
      ],
    })
  })

  it('acting on a selection is asked for by name, never assumed', () => {
    const places = (on?: unknown) => modelActionDefinitions(model([{ ...ship, ...(on === undefined ? {} : { on }) }])).actions[0]?.places
    // One record at a time unless the model says otherwise.
    expect(places()).toEqual(['record', 'row'])
    expect(places(['bulk'])).toEqual(['bulk'])
    expect(places(['bulk', 'row'])).toEqual(['row', 'bulk'])
    expect(places(['bulk', 'record', 'row'])).toEqual(['record', 'row', 'bulk'])
    expect(places('bulk')).toEqual(['bulk'])
  })

  it('a button\'s words come from its name, in sentence case', () => {
    expect(modelActionLabel('ship')).toBe('Ship')
    expect(modelActionLabel('markShipped')).toBe('Mark shipped')
    expect(modelActionLabel('send-password-reset')).toBe('Send password reset')
    expect(modelActionLabel('syncApiKeys')).toBe('Sync API keys')
    expect(modelActionLabel('rotate-url')).toBe('Rotate URL')
  })

  it('leaves out a declaration it cannot read, and says which and why', () => {
    const { actions, problems } = modelActionDefinitions(model([
      ship,
      {},
      { name: 'has space', action: ship.action },
      { name: '9lives', action: ship.action },
      ship,
      { name: 'no-action' },
      { name: 'job', action: 'Jobs/ShipOrder' },
      { name: 'climbs', action: 'Actions/../../secrets' },
      { name: 'controller', action: 'Controllers/OrderController@ship' },
      { name: 'when-text', action: ship.action, when: 'paid' },
      { name: 'when-object', action: ship.action, when: { status: { not: 'paid' } } },
      { name: 'when-empty', action: ship.action, when: { status: [] } },
      { name: 'when-field', action: ship.action, when: { 'status; DROP': 'paid' } },
      { name: 'on-toolbar', action: ship.action, on: ['toolbar'] },
      { name: 'on-mixed', action: ship.action, on: ['row', 'toolbar'] },
      { name: 'on-none', action: ship.action, on: [] },
    ]))
    // An unreadable condition never becomes "always": that would offer the
    // action for every record, the opposite of what was asked.
    expect(actions.map(action => action.name)).toEqual(['ship'])
    expect(problems).toEqual([
      'actions[1] has no name',
      '\'has space\' is not a usable name: letters and digits, in camelCase or kebab-case',
      '\'9lives\' is not a usable name: letters and digits, in camelCase or kebab-case',
      '\'ship\' is declared twice',
      '\'no-action\' does not name an action to run: `action` is its path under app/, as in \'Actions/Orders/ShipOrderAction\'',
      '\'job\' does not name an action to run: `action` is its path under app/, as in \'Actions/Orders/ShipOrderAction\'',
      '\'climbs\' does not name an action to run: `action` is its path under app/, as in \'Actions/Orders/ShipOrderAction\'',
      '\'controller\' does not name an action to run: `action` is its path under app/, as in \'Actions/Orders/ShipOrderAction\'',
      '\'when-text\' has a `when` that cannot be read: it maps a field to the value, or list of values, a record must hold',
      '\'when-object\' has a `when` that cannot be read: it maps a field to the value, or list of values, a record must hold',
      '\'when-empty\' has a `when` that cannot be read: it maps a field to the value, or list of values, a record must hold',
      '\'when-field\' has a `when` that cannot be read: it maps a field to the value, or list of values, a record must hold',
      '\'on-toolbar\' lists a place under `on` that is not \'record\', \'row\' or \'bulk\'',
      '\'on-mixed\' lists a place under `on` that is not \'record\', \'row\' or \'bulk\'',
      '\'on-none\' lists a place under `on` that is not \'record\', \'row\' or \'bulk\'',
    ])
  })

  it('an icon that is not an icon class is dropped, not put in a class attribute', () => {
    const [action] = modelActionDefinitions(model([{ ...ship, icon: 'i-truck" onclick="alert(1)' }])).actions
    expect(action?.icon).toBe('')
  })
})

describe('which records an action is for', () => {
  const action = (when: unknown) => modelActionDefinitions(model([{ ...ship, when }])).actions[0]!

  it('every record, with no condition', () => {
    expect(modelActionApplies(action(undefined), {})).toBe(true)
  })

  it('a record holding one of the values', () => {
    const paid = action({ status: ['paid', 'packed'] })
    expect(modelActionApplies(paid, { status: 'paid' })).toBe(true)
    expect(modelActionApplies(paid, { status: 'packed' })).toBe(true)
    expect(modelActionApplies(paid, { status: 'draft' })).toBe(false)
    expect(modelActionApplies(paid, { status: null })).toBe(false)
    expect(modelActionApplies(paid, {})).toBe(false)
  })

  it('every condition, not any', () => {
    const unshipped = action({ status: 'paid', shippedAt: null })
    expect(modelActionApplies(unshipped, { status: 'paid', shipped_at: null })).toBe(true)
    expect(modelActionApplies(unshipped, { status: 'paid', shipped_at: '' })).toBe(true)
    expect(modelActionApplies(unshipped, { status: 'paid', shipped_at: '2026-11-01 09:00:00' })).toBe(false)
    expect(modelActionApplies(unshipped, { status: 'draft', shipped_at: null })).toBe(false)
  })

  it('a boolean however the driver stored it', () => {
    const active = action({ isActive: true })
    for (const stored of [true, 1, '1', 'true'])
      expect(modelActionApplies(active, { is_active: stored })).toBe(true)
    for (const stored of [false, 0, '0', null, undefined])
      expect(modelActionApplies(active, { is_active: stored })).toBe(false)
    expect(modelActionApplies(action({ isActive: false }), { is_active: 0 })).toBe(true)
  })

  it('a number as text or as a number, and never nothing as zero', () => {
    const none = action({ attempts: 0 })
    expect(modelActionApplies(none, { attempts: 0 })).toBe(true)
    expect(modelActionApplies(none, { attempts: '0' })).toBe(true)
    expect(modelActionApplies(none, { attempts: null })).toBe(false)
  })

  it('reads a model instance as well as a plain row', () => {
    // The ORM's rows answer `get(column)`; a projected row is a plain object.
    const stored: Record<string, unknown> = { status: 'paid' }
    expect(modelActionApplies(action({ status: 'paid' }), { get: (column: string) => stored[column] })).toBe(true)
    expect(modelActionApplies(action({ status: 'draft' }), { get: (column: string) => stored[column] })).toBe(false)
  })
})

describe('what the page is told', () => {
  it('not the file an action runs, nor the rule that narrows it', () => {
    const [action] = modelActionDefinitions(model([{ ...ship, when: { status: 'paid' } }])).actions
    const shown = publicModelAction(action!)
    expect(Object.keys(shown).sort()).toEqual(['confirm', 'destructive', 'fields', 'icon', 'label', 'name', 'places'])
    expect(JSON.stringify(shown)).not.toContain('ShipOrderAction')
  })

  it('offers only actions that load, and names the one that does not once', async () => {
    const warnings: string[] = []
    const warn = console.warn
    console.warn = (...parts: unknown[]) => void warnings.push(parts.map(String).join(' '))
    try {
      const declared = model([ship, { name: 'refund', action: 'Actions/Orders/RefundOrderAction' }])
      let asked = 0
      const resolve = async (handler: string) => {
        asked += 1
        if (handler.includes('Refund'))
          throw new Error('Cannot find module app/Actions/Orders/RefundOrderAction.ts')
        return () => new Response()
      }
      expect((await modelActions(declared, 'OrderLoadable', resolve)).map(action => action.name)).toEqual(['ship'])
      expect((await modelActions(declared, 'OrderLoadable', resolve)).map(action => action.name)).toEqual(['ship'])
      // Looked for once each, however often the list is drawn.
      expect(asked).toBe(2)
      expect(warnings).toEqual(['[dashboard] OrderLoadable dashboard.actions: \'refund\' names Actions/Orders/RefundOrderAction, which could not be loaded (Cannot find module app/Actions/Orders/RefundOrderAction.ts). It is left out.'])
    }
    finally {
      console.warn = warn
    }
  })
})

describe('what came of running an action', () => {
  const told = async (result: Response) => {
    const outcome = await modelActionOutcome(result, 'Mark as shipped')
    return outcome instanceof Response ? { status: outcome.status, body: await outcome.json() } : outcome
  }

  it('a success is its message and where to go, and nothing else it answered', async () => {
    expect(await told(Response.json({ message: ' Order 31 was shipped. ', redirect: '/models/order/31', order: { total: 4200 } })))
      .toEqual({ ok: true, message: 'Order 31 was shipped.', redirect: '/models/order/31' })
    expect(await told(new Response(null, { status: 204 }))).toEqual({ ok: true, message: '', redirect: '' })
    expect(await told(new Response('done'))).toEqual({ ok: true, message: '', redirect: '' })
    expect(await told(Response.json([1, 2]))).toEqual({ ok: true, message: '', redirect: '' })
  })

  it('only follows a path inside the dashboard', async () => {
    for (const redirect of ['https://example.com', '//example.com/x', 'javascript:alert(1)', 'models/order/31', 31, null])
      expect(await told(Response.json({ redirect }))).toEqual({ ok: true, message: '', redirect: '' })
    expect((await told(Response.json({ redirect: '/models/order?filters=%7B%22status%22%3A%22paid%22%7D' })) as { redirect: string }).redirect)
      .toBe('/models/order?filters=%7B%22status%22%3A%22paid%22%7D')
  })

  it('a refusal keeps its status and its words', async () => {
    expect(await told(Response.json({ message: 'Already shipped.' }, { status: 409 }))).toEqual({ status: 409, body: { message: 'Already shipped.' } })
    expect(await told(Response.json({ error: 'No address on file.' }, { status: 422 }))).toEqual({ status: 422, body: { message: 'No address on file.' } })
    expect(await told(Response.json({ message: 'Validation failed', errors: { carrier: ['Choose a carrier.'] } }, { status: 422 })))
      .toEqual({ status: 422, body: { message: 'Validation failed', errors: { carrier: ['Choose a carrier.'] } } })
    expect(await told(new Response('Carrier is offline.', { status: 503 }))).toEqual({ status: 503, body: { message: 'Carrier is offline.' } })
  })

  it('a refusal with nothing sayable says which action was refused', async () => {
    expect(await told(new Response(null, { status: 500 }))).toEqual({ status: 500, body: { message: 'Mark as shipped was refused.' } })
    expect(await told(new Response('<!doctype html><h1>Whoops</h1>', { status: 500 }))).toEqual({ status: 500, body: { message: 'Mark as shipped was refused.' } })
    expect(await told(new Response('x'.repeat(301), { status: 500 }))).toEqual({ status: 500, body: { message: 'Mark as shipped was refused.' } })
  })
})

describe('the pages', () => {
  const record = () => import('../../storage/framework/defaults/functions/dashboard-model-record')
  const ship = { name: 'ship', label: 'Mark as shipped', icon: 'i-hugeicons-truck-delivery', confirm: '', destructive: false, places: ['record', 'row'] as Array<'record' | 'row'> }
  const revoke = { name: 'revoke', label: 'Revoke access', icon: '', confirm: 'Every session is ended at once.', destructive: true, places: ['row'] as Array<'record' | 'row'> }

  it('a row is offered what the server listed for it, where each belongs', async () => {
    const { modelActionsFor } = await record()
    const rowActions = { 7: ['ship', 'revoke'], 8: ['revoke'] }
    expect(modelActionsFor([ship, revoke], rowActions, 7, 'row').map(action => action.name)).toEqual(['ship', 'revoke'])
    expect(modelActionsFor([ship, revoke], rowActions, '7', 'record').map(action => action.name)).toEqual(['ship'])
    expect(modelActionsFor([ship, revoke], rowActions, 8, 'row').map(action => action.name)).toEqual(['revoke'])
    // A row the server did not list is offered nothing, not everything.
    expect(modelActionsFor([ship, revoke], rowActions, 9, 'row')).toEqual([])
    expect(modelActionsFor([ship, revoke], undefined, 7, 'row')).toEqual([])
    expect(modelActionsFor(undefined, rowActions, 7, 'row')).toEqual([])
  })

  it('an icon is the action\'s own or a bolt, and red when it is destructive', async () => {
    const { modelActionIconClass } = await record()
    expect(modelActionIconClass(ship)).toBe('h-4 w-4 text-neutral-500 dark:text-neutral-400 i-hugeicons-truck-delivery')
    expect(modelActionIconClass(revoke)).toBe('h-4 w-4 text-red-500 i-hugeicons-flash')
  })

  it('a press is always answered', async () => {
    const { modelActionNotice } = await record()
    expect(modelActionNotice(ship, { ok: true, message: 'Order 31 was shipped.', redirect: '' })).toEqual({ tone: 'success', title: 'Mark as shipped', detail: 'Order 31 was shipped.' })
    expect(modelActionNotice(ship, { ok: true, message: '', redirect: '' })).toEqual({ tone: 'success', title: 'Mark as shipped', detail: 'Done.' })
    expect(modelActionNotice(ship, { ok: false, error: 'Already shipped.' })).toEqual({ tone: 'error', title: 'Mark as shipped did not run', detail: 'Already shipped.' })
  })

  // Driven in a browser against the running dashboard; these pin what that
  // run relied on.
  it('the record page and the list draw them and run them', async () => {
    const { readFileSync } = await import('node:fs')
    const components = 'storage/framework/defaults/resources/components/Dashboard/Models'
    const page = readFileSync(`${components}/ModelRecordDetail.stx`, 'utf8')
    expect(page).toContain('const actions = derived(() => record()?.actions ?? [])')
    expect(page).toContain('<Button :for="action in actions()" variant="outline" :disabled="running() !== \'\'" @click="startAction(action)">')
    expect(page).toContain('const result = await runModelAction(slug(), recordId(), action.name, input)')
    expect(page).toContain(':description="confirmingAction()?.confirm || \'\'"')

    const list = readFileSync(`${components}/ModelRecordsDashboard.stx`, 'utf8')
    expect(list).toContain('return modelActionsFor(actions(), rowActions(), String(row.id), \'row\')')
    expect(list).toContain(':actions="actionsFor(row)"')
    expect(list).toContain('@action="startAction"')
    expect(list).toContain('const result = await runModelAction(slug(), String(row.id), action.name, input)')

    // The loop is on a wrapper: on the button itself, inside a component
    // drawn once per row, the icon's class came out empty.
    const row = readFileSync(`${components}/ModelRecordActions.stx`, 'utf8')
    expect(row).toContain('<span :for="action in actions()" class="contents">')
    expect(row).not.toMatch(/<Button\s+:for=/)
    expect(row).toContain(':title="action.label"')
    expect(row).toContain('<span aria-hidden="true" :class="iconClass(action)"></span>')

    const client = readFileSync('storage/framework/defaults/functions/dashboard-model-record.ts', 'utf8')
    expect(client).toContain('`${modelPath(slug)}/${encodeURIComponent(String(id))}/actions/${encodeURIComponent(name)}`')
    expect(client).toContain('actions: modelActionsFor(data.actions, data.rowActions, id, \'record\'),')
  })

  it('the route that runs one is guarded like every other dashboard write', async () => {
    const { readFileSync } = await import('node:fs')
    const routes = readFileSync('storage/framework/defaults/routes/dashboard-api.ts', 'utf8')
    expect(routes).toContain('guard(route.post(\'/models/{dashboardModel}/{id}/actions/{dashboardAction}\', \'Actions/Dashboard/Models/ModelActionRunAction\'))')
  })
})

/**
 * An action that takes input is asked for it in a form
 * (stacksjs/stacks#3273). A button could not give an action anything, so one
 * that validated a `reason` could be declared and could never succeed.
 */
describe('what an action has to be told', () => {
  const { schema } = require('@stacksjs/validation') as typeof import('@stacksjs/validation')
  const refund = () => ({
    id: { rule: schema.number().required() },
    reason: { rule: schema.string().required().min(3), message: 'Say why.' },
    amount: { rule: schema.number().min(1) },
    restock: { rule: schema.boolean() },
    method: { rule: schema.enum(['card', 'credit']).required() },
    notifyAt: { rule: schema.timestamp() },
    attachments: { rule: schema.array() },
  })

  it('a field for each of its validations, in the control the rule calls for', async () => {
    const { modelActionFields } = await import('../../storage/framework/defaults/app/Actions/Dashboard/Models/model-actions')
    const { fields, unaskable, ignored } = modelActionFields(refund())
    expect(fields).toEqual([
      { name: 'reason', label: 'Reason', type: 'text', required: true, defaultValue: '', options: [] },
      { name: 'amount', label: 'Amount', type: 'number', required: false, defaultValue: '', options: [] },
      { name: 'restock', label: 'Restock', type: 'boolean', required: false, defaultValue: false, options: [] },
      { name: 'method', label: 'Method', type: 'enum', required: true, defaultValue: '', options: ['card', 'credit'] },
      { name: 'notifyAt', label: 'Notify at', type: 'datetime', required: false, defaultValue: '', options: [] },
    ])
    // Never the record's id: that is the row whose button was pressed. And an
    // optional list is left out of the form, not asked for as text.
    expect(fields.map(field => field.name)).not.toContain('id')
    expect(fields.map(field => field.name)).not.toContain('attachments')
    expect(unaskable).toEqual([])
    expect(ignored).toEqual([])
  })

  it('nothing, for an action that validates nothing', async () => {
    const { modelActionFields } = await import('../../storage/framework/defaults/app/Actions/Dashboard/Models/model-actions')
    for (const validations of [undefined, null, {}, [], 'reason', { id: { rule: schema.number() }, dashboardModel: { rule: schema.string() }, dashboardAction: { rule: schema.string() } }])
      expect(modelActionFields(validations).fields).toEqual([])
  })

  it('what no form can give is named, when the action requires it', async () => {
    const { modelActionFields } = await import('../../storage/framework/defaults/app/Actions/Dashboard/Models/model-actions')
    const { fields, unaskable } = modelActionFields({
      rows: { rule: schema.array().required() },
      options: { rule: schema.object() },
      secret: { rule: schema.password().required() },
      note: { rule: schema.string() },
    })
    // `object()` is required as it comes; a list and a password say so.
    expect(unaskable).toEqual(['rows', 'options', 'secret'])
    expect(fields.map(field => field.name)).toEqual(['note'])
  })

  it('the model says how a field is asked, in the words `dashboard.fields` uses', async () => {
    const { modelActionFields } = await import('../../storage/framework/defaults/app/Actions/Dashboard/Models/model-actions')
    const { fields, ignored } = modelActionFields(refund(), {
      reason: { label: 'Reason for the refund', input: 'longtext', help: 'Shown to the customer.' },
      amount: { input: 'longtext', label: 'How much' },
      nonsense: { label: 'Nope' },
    })
    expect(fields[0]).toEqual({ name: 'reason', label: 'Reason for the refund', type: 'longtext', required: true, defaultValue: '', options: [], help: 'Shown to the customer.' })
    // A number stays a number, under the model's name for it.
    expect(fields[1]).toMatchObject({ name: 'amount', label: 'How much', type: 'number' })
    expect(ignored).toEqual([
      'field \'amount\' asks for the \'longtext\' input, but it is not a field of text (it is asked for as number)',
      'describes a field \'nonsense\' that the action does not take',
    ])
  })

  it('a declaration\'s `fields` are read like a model\'s, and a bad one is said by name', () => {
    const declared = modelActionDefinitions(model([
      { ...ship, fields: { reason: { label: ' Why ', input: 'longtext', help: 'Shown.' } } },
      { name: 'refund', action: ship.action, fields: 'reason' },
      { name: 'void', action: ship.action, fields: { reason: 'required', note: { input: 'richtext', label: 7 } } },
    ]))
    expect(declared.actions.map(action => action.asking)).toEqual([
      { reason: { label: 'Why', input: 'longtext', help: 'Shown.' } },
      {},
      { note: {} },
    ])
    expect(declared.problems).toEqual([
      '\'refund\' has `fields` that is not an object keyed by the input\'s name',
      '\'void\' field \'reason\' is not an object of settings',
      '\'void\' field \'note\' has a label that is not text',
      '\'void\' field \'note\' asks for an input the dashboard does not have: \'richtext\' (it has email, longtext, text, url)',
    ])
  })

  it('an action is offered with its form, or left out when it requires what a form cannot give', async () => {
    const warnings: string[] = []
    const warn = console.warn
    console.warn = (...parts: unknown[]) => void warnings.push(parts.map(String).join(' '))
    try {
      const declared = model([
        { name: 'refund', action: 'Actions/Orders/RefundOrderAction', fields: { reason: { label: 'Why' } } },
        { name: 'import', action: 'Actions/Orders/ImportLinesAction' },
        ship,
      ])
      const resolve = async (handler: string) => handler.includes('Refund')
        ? { validations: refund() }
        : handler.includes('Import') ? { validations: { rows: { rule: schema.array().required() } } } : {}
      const offered = await modelActions(declared, 'OrderForms', resolve)
      expect(offered.map(action => [action.name, action.fields.map(field => field.label)])).toEqual([
        ['refund', ['Why', 'Amount', 'Restock', 'Method', 'Notify at']],
        ['ship', []],
      ])
      // The page is told the form, and still not the file or the rule.
      expect(Object.keys(publicModelAction(offered[0]!)).sort()).toEqual(['confirm', 'destructive', 'fields', 'icon', 'label', 'name', 'places'])
      expect(warnings).toEqual(['[dashboard] OrderForms dashboard.actions: \'import\' runs Actions/Orders/ImportLinesAction, which requires \'rows\': a value a form cannot give (a list, a structure, a file or a password). It is left out.'])
    }
    finally {
      console.warn = warn
    }
  })
})

describe('what a form sends', () => {
  const fields = [
    { name: 'reason', label: 'Reason', type: 'longtext' as const, required: true, defaultValue: '', options: [] },
    { name: 'amount', label: 'Amount', type: 'number' as const, required: false, defaultValue: '', options: [] },
    { name: 'restock', label: 'Restock', type: 'boolean' as const, required: false, defaultValue: false, options: [] },
    { name: 'method', label: 'Method', type: 'enum' as const, required: true, defaultValue: '', options: ['card', 'credit'] },
    { name: 'notifyAt', label: 'Notify at', type: 'datetime' as const, required: false, defaultValue: '', options: [] },
    { name: 'day', label: 'Day', type: 'date' as const, required: false, defaultValue: '', options: [] },
  ]
  const record = () => import('../../storage/framework/defaults/functions/dashboard-model-record')

  it('each value the type its rule expects', async () => {
    const { modelActionInput } = await record()
    expect(modelActionInput(fields, { reason: 'Arrived damaged', amount: '1200', restock: true, method: 'card', notifyAt: '2026-11-12T09:30', day: '2026-11-12' })).toEqual({
      reason: 'Arrived damaged',
      // A rule for a number refuses the digits as text.
      amount: 1200,
      restock: true,
      method: 'card',
      notifyAt: new Date('2026-11-12T09:30').toISOString(),
      day: '2026-11-12',
    })
  })

  it('a field left empty is left out, and a box left unticked is false', async () => {
    const { modelActionInput } = await record()
    expect(modelActionInput(fields, { reason: 'Recall', amount: '', restock: false, method: 'credit', notifyAt: '', day: '' })).toEqual({ reason: 'Recall', restock: false, method: 'credit' })
    expect(modelActionInput(fields, {})).toEqual({ restock: false })
    // Not a number: sent as typed, for the action's rule to refuse in its own words.
    expect(modelActionInput(fields, { amount: 'lots' })).toMatchObject({ amount: 'lots' })
  })

  it('only an action with fields opens a form', async () => {
    const { modelActionAsks } = await record()
    const base = { name: 'ship', label: 'Ship', icon: '', confirm: '', destructive: false, places: ['row' as const] }
    expect(modelActionAsks({ ...base, fields })).toBe(true)
    expect(modelActionAsks({ ...base, fields: [] })).toBe(false)
    expect(modelActionAsks(base)).toBe(false)
    expect(modelActionAsks(null)).toBe(false)
  })

  // Driven in a browser against the running dashboard; these pin what that
  // run relied on.
  it('the record page, a row and a selection all ask through one form', async () => {
    const { readFileSync } = await import('node:fs')
    const components = 'storage/framework/defaults/resources/components/Dashboard/Models'
    const form = readFileSync(`${components}/ModelActionForm.stx`, 'utf8')
    expect(form).toContain('emit(\'submit\', modelActionInput(current.fields ?? [], values()))')
    expect(form).toContain('const description = derived(() => [action()?.confirm ?? \'\', note()].filter(Boolean).join(\' \'))')
    expect(form).toContain('<form id="model-action-form" class="flex flex-col gap-5" data-action-form @submit.prevent="submit">')

    for (const file of ['ModelRecordDetail.stx', 'ModelRecordsDashboard.stx']) {
      const page = readFileSync(`${components}/${file}`, 'utf8')
      expect(page).toContain('<ModelActionForm')
      expect(page).toContain('@submit="submitAction"')
      // A refusal of what was typed is answered in the form, not in a toast.
      expect(page).toContain('if (!result.ok && askingAction()) {')
      expect(page).toContain('actionErrors.set(result.errors ?? {})')
    }
    const list = readFileSync(`${components}/ModelRecordsDashboard.stx`, 'utf8')
    expect(list).toContain('if (Object.keys(result.invalid).length > 0) {')
    expect(list).toContain(':note="actionFormNote()"')

    const client = readFileSync('storage/framework/defaults/functions/dashboard-model-record.ts', 'utf8')
    expect(client).toContain('{ method: \'POST\', body: input },')
  })
})
