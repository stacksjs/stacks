import { afterAll, describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { schema } from '@stacksjs/validation'
import { modelFormFields } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-forms'
import { relatedPanel } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-related'
import type { ModelRelatedPanel } from '../../storage/framework/defaults/functions/dashboard-model-record'
import { modelRelatedAddsHere, modelRelatedRowActions } from '../../storage/framework/defaults/functions/dashboard-model-record'

/**
 * A record's related rows are managed from its own page
 * (stacksjs/stacks#3270).
 *
 * The panels on a record's page were read only: a team's members could be
 * looked at there and changed somewhere else. Where the related model lets
 * the dashboard write its rows, the panel now adds, edits and deletes them,
 * each as one write through that model's own endpoint.
 *
 * Not one form that saves a record and its rows together: a write through a
 * model takes no part in a transaction (stacksjs/stacks#3269), so that could
 * leave the record changed and a row not.
 */
describe('a team\'s members, through a real server', () => {
  it('are added, edited and deleted with what the panel carries', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stacks-related-rows-'))
    try {
      const config = join(directory, 'bunfig.toml')
      await writeFile(config, 'preload = []\n')
      const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', `${import.meta.dir}/fixtures/model-related-rows.ts`], {
        env: { ...process.env, APP_ENV: 'test', MAIL_MAILER: 'log', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'teams.sqlite'), DB_QUERY_LOGGING_ENABLED: 'false' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const watchdog = setTimeout(() => child.kill(), 50_000)
      try {
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(stdout).toContain('related rows OK')
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

describe('what a panel lets its rows be', () => {
  const globals = globalThis as Record<string, unknown>
  const names = ['Fleet', 'Vessel', 'Captain']
  afterAll(() => {
    for (const name of names)
      delete globals[name]
  })

  /** A model as the dashboard resolves one: a global with a query. */
  function install(name: string, definition: Record<string, unknown>, rows: Array<Record<string, unknown>> = []): void {
    const query = () => {
      let matched = rows
      const chain: any = {
        where: (column: string, value: unknown) => (matched = matched.filter(row => String(row[column]) === String(value)), chain),
        whereIn: (column: string, values: unknown[]) => (matched = matched.filter(row => values.map(String).includes(String(row[column]))), chain),
        orderBy: () => chain,
        take: () => chain,
        count: async () => matched.length,
        get: async () => matched,
      }
      return chain
    }
    globals[name] = { name, ...definition, where: () => {}, query, find: async () => null }
  }

  const vessel = (routes: unknown) => ({
    belongsTo: ['Fleet', 'Captain'],
    traits: { useApi: routes === true ? true : { routes } },
    attributes: {
      name: { fillable: true, validation: { rule: schema.string().required() } },
      status: { fillable: true, default: 'docked', validation: { rule: schema.enum(['docked', 'at-sea']) } },
      secret: { fillable: true, hidden: true, validation: { rule: schema.string() } },
      tonnage: { validation: { rule: schema.number() } },
    },
    dashboard: { fields: { name: { label: 'Call sign', help: 'Painted on the hull.' } } },
  })
  const rows = [{ id: 4, fleet_id: 3, captain_id: 9, name: 'Dawn', status: 'at-sea', secret: 'x', tonnage: 800 }]
  const panel = async () => (await relatedPanel('Fleet', 3, { kind: 'many', model: 'Vessel', slug: 'vessel', foreignKey: null }))!

  it('everything its model allows, with the form and each row\'s values', async () => {
    install('Captain', { attributes: { name: {} } }, [{ id: 9, name: 'Ada' }])
    install('Vessel', vessel(true), rows)
    const built = await panel()
    expect([built.canCreate, built.canUpdate, built.canDestroy]).toEqual([true, true, true])
    // The related model's own form: its fillable fields, named and helped as
    // its own pages do, with the record it points at picked by name. Never
    // the link back to this record, a hidden field, or one that is not fillable.
    expect(built.fields.map(field => [field.name, field.type, field.label])).toEqual([
      ['name', 'text', 'Call sign'],
      ['status', 'enum', 'Status'],
      ['captainId', 'relation', 'Captain'],
    ])
    expect(built.fields[0]!.help).toBe('Painted on the hull.')
    // What an edit starts from: the stored values, the id and not the name it shows as.
    expect(built.values).toEqual({ 4: { name: 'Dawn', status: 'at-sea', captain_id: 9 } })
    expect(built.rows[0]).toMatchObject({ id: 4, captain_id: 'Ada' })
    expect(JSON.stringify(built.values)).not.toContain('fleet_id')
    expect(JSON.stringify(built)).not.toContain('secret')
  })

  it('only what its model allows', async () => {
    install('Captain', { attributes: { name: {} } }, [{ id: 9, name: 'Ada' }])
    // Read only: nothing to ask for and nothing to start from.
    install('Vessel', vessel(['index', 'show']), rows)
    expect(await panel()).toMatchObject({ canCreate: false, canUpdate: false, canDestroy: false, fields: [], values: {} })
    // Deleting only.
    install('Vessel', vessel(['index', 'destroy']), rows)
    expect(await panel()).toMatchObject({ canCreate: false, canUpdate: false, canDestroy: true, fields: [], values: {} })
    // Adding but not editing: the form, and no values to edit from.
    install('Vessel', vessel(['index', 'store']), rows)
    const adds = await panel()
    expect(adds).toMatchObject({ canCreate: true, canUpdate: false, canDestroy: false, values: {} })
    expect(adds.fields.map(field => field.name)).toEqual(['name', 'status', 'captainId'])
    // `dashboard.writes` decides it, as it does for the model's own pages.
    install('Vessel', { ...vessel(['index', 'show']), dashboard: { writes: ['update'] } }, rows)
    expect(await panel()).toMatchObject({ canCreate: false, canUpdate: true, canDestroy: false })
  })

  it('a relation the dashboard cannot reach is asked for as the id it is, as on the model\'s own form', async () => {
    delete globals.Captain
    install('Vessel', vessel(true), rows)
    const built = await panel()
    expect(built.fields.map(field => [field.name, field.type, field.label])).toContainEqual(['captainId', 'number', 'Captain ID'])
    expect(modelFormFields(globals.Vessel, new Set(['Captain'])).find(field => field.name === 'captainId')).toMatchObject({ type: 'relation', label: 'Captain' })
  })
})

describe('the panel\'s buttons', () => {
  const base: ModelRelatedPanel = { kind: 'many', model: 'TeamMember', slug: 'team-member', title: 'Team Members', label: 'Team Member', foreignKey: 'team_id', field: 'teamId', total: 1, columns: [], rows: [], canCreate: false }
  const fields = [{ name: 'role', label: 'Role', type: 'enum' as const, required: true, defaultValue: 'member', options: ['member'] }]

  it('the eye always, the pencil and the trash where the related model allows', () => {
    expect(modelRelatedRowActions(base)).toEqual([{ action: 'view', label: 'View team member' }])
    expect(modelRelatedRowActions({ ...base, canUpdate: true, canDestroy: true, fields }).map(action => action.label)).toEqual(['View team member', 'Edit team member', 'Delete team member'])
    expect(modelRelatedRowActions({ ...base, canDestroy: true }).map(action => action.action)).toEqual(['view', 'delete'])
    // Editable, but with nothing a form could ask for: no pencil that opens an empty form.
    expect(modelRelatedRowActions({ ...base, canUpdate: true, fields: [] }).map(action => action.action)).toEqual(['view'])
  })

  it('"Add" opens here when there is a form to open, and on the create page when there is not', () => {
    expect(modelRelatedAddsHere({ ...base, canCreate: true, fields })).toBe(true)
    expect(modelRelatedAddsHere({ ...base, canCreate: true, fields: [] })).toBe(false)
    expect(modelRelatedAddsHere({ ...base, canCreate: true })).toBe(false)
    expect(modelRelatedAddsHere({ ...base, canCreate: false, fields })).toBe(false)
  })
})

// Driven in a browser against the running dashboard; these pin what that run
// relied on.
describe('the page', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard/Models'

  it('a panel opens its form over the page and saves one row at a time', () => {
    const panels = readFileSync(`${components}/ModelRelatedPanels.stx`, 'utf8')
    expect(panels).toContain(':row-actions="rowActions(panel)"')
    expect(panels).toContain('@row-action="act(panel, $event)"')
    expect(panels).toContain('openEditor({ panel, id }, modelFormValues(panel.fields ?? [], panel.values?.[String(id)] ?? {}))')
    expect(panels).toContain('const result = await saveModelRelated(current, parentId(), values(), initial())')
    expect(panels).toContain('const outcome = await deleteModelRecord(current.panel.slug, current.row.id as number | string)')
    expect(panels).toContain('<form id="related-row-form" class="flex flex-col gap-5" data-related-editor @submit.prevent="save">')
    expect(panels).toContain('<Button variant="primary" type="submit" form="related-row-form" :loading="saving()">')
    // Told, so the page reads its panels again.
    expect((panels.match(/emit\('changed'\)/g) || []).length).toBe(2)
    expect(readFileSync(`${components}/ModelRecordDetail.stx`, 'utf8')).toContain('@changed="reloadRelated"')
  })

  it('which record a new row belongs to is the page\'s to say, and an edit sends only what changed', () => {
    const client = readFileSync('storage/framework/defaults/functions/dashboard-model-record.ts', 'utf8')
    expect(client).toContain('[editor.panel.field]: Number.isSafeInteger(parent) && parent > 0 ? parent : parentId,')
    expect(client).toContain('const changes = modelFormPayload(fields, values, initial)')
    expect(client).toContain('return { ok: true, changed: false }')
  })

  it('the model\'s own pages and a panel ask for a model\'s fields through one function', () => {
    expect(readFileSync('storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction.ts', 'utf8')).toContain('const formFields = (): ModelCreateField[] => modelFormFields(Model, reachable)')
    expect(readFileSync('storage/framework/defaults/app/Actions/Dashboard/Models/model-related.ts', 'utf8')).toContain('const form = modelFormFields(Related, reachable)')
  })
})
