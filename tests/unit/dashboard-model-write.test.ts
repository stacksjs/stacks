import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  modelCreateFields,
  modelWritableColumns,
  modelWriteCapabilities,
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
    })
    expect(modelWriteCapabilities({ traits: { useApi: true } })).toEqual({
      create: true,
      update: true,
      destroy: true,
    })
    expect(modelWriteCapabilities({
      traits: { useApi: { routes: ['index', 'store', 'show'] } },
    })).toEqual({
      create: true,
      update: false,
      destroy: false,
    })
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
    const modal = source('storage/framework/defaults/resources/components/Dashboard/CreateRecordModal.stx')
    const editor = source('storage/framework/defaults/resources/components/Dashboard/Models/EditRecordModal.stx')
    const actions = source('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordActions.stx')

    expect(page).toContain('<ModelRecordsDashboard />')
    expect(page).not.toContain('<script')
    expect(view).toContain('writeCapabilities.set(data.writeCapabilities')
    expect(view).toContain('createFields.set(data.createFields')
    expect(view).toContain('updateColumns.set(data.updateColumns')
    expect(view).toContain('readonly: !updateColumns().includes(column.name)')
    expect(view).toContain('reason instanceof DashboardApiError && reason.fields')
    expect(view).toContain('<CreateRecordModal')
    expect(view).toContain('<EditRecordModal')
    expect(view).toContain('<ModelRecordActions')
    expect(view).toContain('right-0 sticky z-20')
    expect(view).toContain('right-0 sticky z-10')
    expect(view).toContain('<Button')
    expect(view).toContain('@submit="createRecord($event)"')
    expect(view).toContain('<ConfirmDialog')
    expect(view).toContain('@confirm="confirmDelete"')
    expect(view).not.toContain('bg-blue-600 hover:bg-blue-500')
    expect(modal).toContain("const fields = useReactiveProp('fields'")
    expect(modal).toContain('<Button')
    expect(modal).toContain('<Select')
    expect(modal).toContain('<Input')
    expect(modal.match(/:name="field\.name"/g)).toHaveLength(3)
    expect(modal).toContain('@submit.prevent="submit"')
    expect(modal).not.toContain('bg-blue-600 hover:bg-blue-500')
    expect(modal).not.toMatch(/\b(?:document|window)\./)
    expect(modal).not.toContain('/api/data/')
    expect(modal).not.toContain('<svg')
    expect(editor).toContain("const fields = useReactiveProp('fields'")
    expect(editor).toContain('<Modal')
    expect(editor).toContain('id="model-edit-form"')
    expect(editor).toContain('form="model-edit-form"')
    expect(editor).toContain(':name="field.readonly ? undefined : field.name"')
    expect(editor).toContain('.filter(field => !field.readonly)')
    expect(editor).not.toMatch(/\b(?:document|window)\./)
    expect(actions).toContain("const record = useReactiveProp('record'")
    expect(actions).toContain("emit('edit', record())")
    expect(actions).toContain("emit('delete', record())")
  })
})
