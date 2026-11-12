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
      handler: 'Actions/Orders/ShipOrderAction',
      when: [],
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
    expect(Object.keys(shown).sort()).toEqual(['confirm', 'destructive', 'icon', 'label', 'name', 'places'])
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
    expect(page).toContain('const result = await runModelAction(slug(), recordId(), action.name)')
    expect(page).toContain(':description="confirmingAction()?.confirm || \'\'"')

    const list = readFileSync(`${components}/ModelRecordsDashboard.stx`, 'utf8')
    expect(list).toContain('return modelActionsFor(actions(), rowActions(), String(row.id), \'row\')')
    expect(list).toContain(':actions="actionsFor(row)"')
    expect(list).toContain('@action="startAction"')
    expect(list).toContain('const result = await runModelAction(slug(), String(row.id), action.name)')

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
