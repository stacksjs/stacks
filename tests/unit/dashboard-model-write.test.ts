import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  modelCreateFields,
  modelWritableColumns,
  modelWriteCapabilities,
  uncollectableRequiredFields,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'
import { modelApiConfiguration } from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-api'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('dashboard generic model writes', () => {
  test('normalizes useApi metadata with the ORM defaults', () => {
    expect(modelApiConfiguration({ name: 'Product', table: 'products', traits: {} })).toEqual({
      uri: '',
      routes: [],
    })
    expect(modelApiConfiguration({ name: 'Product', table: 'products', traits: { useApi: true } })).toEqual({
      uri: 'products',
      routes: ['index', 'show', 'store', 'update', 'destroy'],
    })
    expect(modelApiConfiguration({
      name: 'Product',
      table: 'products',
      traits: { useApi: { uri: 'catalog', routes: [] } },
    })).toEqual({
      uri: 'catalog',
      routes: [],
    })
  })

  test('capabilities follow the model useApi route declaration', () => {
    expect(modelWriteCapabilities({ traits: {} })).toEqual({
      create: false,
      update: false,
      destroy: false,
      invite: false,
      anonymize: false,
    })
    expect(modelWriteCapabilities({ traits: { useApi: true } })).toEqual({
      create: true,
      update: true,
      destroy: true,
      invite: false,
      anonymize: false,
    })
    expect(modelWriteCapabilities({
      traits: { useApi: { routes: ['index', 'store', 'show'] } },
    })).toEqual({
      create: true,
      update: false,
      destroy: false,
      invite: false,
      anonymize: false,
    })
  })

  test('a model is creatable only when the form can supply every required field', () => {
    // User.password: required, hidden from the form, no default. Every
    // "Create user" used to end in a database error after the form was filled.
    const required = { isRequired: true }
    const user = {
      traits: { useApi: { routes: ['index', 'store', 'show'] } },
      attributes: {
        name: { fillable: true, validation: { rule: required } },
        password: { fillable: true, hidden: true, validation: { rule: required } },
      },
    }
    expect(uncollectableRequiredFields(user)).toEqual(['password'])
    expect(modelWriteCapabilities(user).create).toBe(false)

    // Hidden but optional, hidden with a default, or required and on the form: all creatable.
    for (const attributes of [
      { token: { fillable: true, hidden: true } },
      { token: { fillable: true, hidden: true, default: 'none', validation: { rule: required } } },
      { name: { fillable: true, required: true } },
      { secret: { hidden: true, validation: { rule: required } } },
    ]) {
      const model = { traits: { useApi: { routes: ['store'] } }, attributes }
      expect(uncollectableRequiredFields(model)).toEqual([])
      expect(modelWriteCapabilities(model).create).toBe(true)
    }
    // Updating and deleting are not affected.
    expect(modelWriteCapabilities({ ...user, traits: { useApi: true } })).toEqual({ create: false, update: true, destroy: true, invite: false, anonymize: false })
  })

  test('create fields come only from safe fillable model metadata', () => {
    const fields = modelCreateFields({
      attributes: {
        name: {
          order: 2,
          fillable: true,
          validation: { rule: { name: 'string', isRequired: true } },
        },
        email: {
          order: 1,
          fillable: true,
          validation: { rule: { name: 'string', isRequired: true } },
        },
        status: {
          order: 3,
          fillable: true,
          default: 'draft',
          validation: { rule: { name: 'enum', allowedValues: ['draft', 'live'] } },
        },
        password: { order: 4, fillable: true },
        twoFactorSecret: { order: 5, fillable: true },
        internalNote: { order: 6, fillable: true, hidden: true },
        ignored: { order: 7, fillable: false },
      },
      belongsTo: ['Team'],
    })

    expect(fields.map(field => field.name)).toEqual(['email', 'name', 'status', 'teamId'])
    expect(fields[0]).toMatchObject({ label: 'Email', type: 'email', required: true })
    expect(fields[2]).toMatchObject({
      type: 'enum',
      defaultValue: 'draft',
      options: ['draft', 'live'],
    })
    expect(fields[3]).toMatchObject({ label: 'Team ID', type: 'number' })
    expect(modelWritableColumns({
      attributes: {
        displayName: { fillable: true },
        internalNote: { fillable: false },
      },
      belongsTo: ['Team'],
    })).toEqual(['display_name', 'team_id'])
  })

  test('store action writes through the model and the guarded dashboard route', () => {
    const action = source('storage/framework/defaults/app/Actions/Dashboard/Models/ModelStoreAction.ts')
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')

    expect(action).toContain("resolveWritableModel(request.getParam('slug'), 'store')")
    expect(action).toContain('request.all()')
    expect(action).not.toContain('request as any')
    expect(action).toContain('await resolved.Model.create(toSnakeCaseKeys(data))')
    expect(action).toContain("response.json({ message: 'Validation failed.', errors }, 422)")
    expect(action).toContain("dashboardOperationalError(error, 'The model record could not be created.', 'ModelStoreAction', 500)")
    expect(action).not.toContain('insertInto(')
    expect(routes).toContain("guard(route.post('/models/{slug}', 'Actions/Dashboard/Models/ModelStoreAction'))")
  })

  test('model browser consumes capability and create-field metadata', () => {
    const page = source('storage/framework/defaults/views/dashboard/models/[model].stx')
    const view = source('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordsDashboard.stx')
    const create = source('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordCreate.stx')
    const editor = source('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordEdit.stx')
    const record = source('storage/framework/defaults/functions/dashboard-model-record.ts')
    const actions = source('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordActions.stx')

    expect(page).toContain('<ModelRecordsDashboard />')
    expect(page).not.toContain('<script')
    expect(view).toContain('writeCapabilities.set({ ...NO_WRITES, ...data.writeCapabilities })')
    // Which columns an edit may change is the edit page's business now.
    expect(record).toContain('fields: data.updateFields ?? [],')
    // Creating is a page of its own; the browser only links to it.
    expect(view).not.toContain('<CreateRecordModal')
    expect(view).toContain('navigate(modelRecordCreateHref(slug()))')
    expect(record).toContain('if (reason instanceof DashboardApiError)')
    expect(record).toContain('fields: data.createFields ?? []')
    expect(view).not.toContain('<EditRecordModal')
    expect(view).toContain('navigate(modelRecordEditHref(slug(), String(row.id)))')
    expect(view).toContain('<ModelRecordActions')
    expect(view).toContain('right-0 sticky z-20')
    expect(view).toContain('right-0 sticky z-10')
    expect(view).toContain('<Button')
    expect(view).toContain('<ConfirmDialog')
    expect(view).toContain('@confirm="confirmDelete"')
    expect(view).not.toContain('bg-blue-600 hover:bg-blue-500')
    expect(create).toContain('fetchModelCreateForm(slug())')
    expect(create).toContain('<Button')
    // The fields themselves are drawn by the inputs both forms share.
    expect(create).toContain('<ModelFieldInputs :fields="fields()" :values="values()" :errors="createErrors()"')
    expect(create).toContain('@submit.prevent="create"')
    expect(create).toContain('createErrors.set(result.errors)')
    expect(create).not.toContain('<Modal')
    expect(create).not.toContain('bg-blue-600 hover:bg-blue-500')
    expect(create).not.toMatch(/\b(?:document|window)\./)
    expect(create).not.toContain('/api/data/')
    expect(create).not.toContain('<svg')
    // Only the writable columns are inputs, and only what changed is sent.
    expect(editor).toContain('id="model-edit-form"')
    expect(editor).toContain('@submit.prevent="save"')
    expect(editor).toContain('const writable = derived(() => record()?.fields ?? [])')
    expect(editor).toContain('<ModelFieldInputs :fields="writable()"')
    expect(editor).toContain('modelFormPayload(current.fields, values(), initial())')
    expect(editor).toContain('record()?.writeCapabilities.update')
    expect(editor).not.toMatch(/\b(?:document|window)\./)
    expect(actions).toContain("const record = useReactiveProp('record'")
    expect(actions).toContain("emit('edit', record())")
    expect(actions).toContain("emit('delete', record())")
  })
})
