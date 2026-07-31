import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  modelCreateFields,
  modelWriteCapabilities,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Models/model-write'

function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('dashboard generic model writes', () => {
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
  })

  test('store action writes through the model and the guarded dashboard route', () => {
    const action = source('storage/framework/defaults/app/Actions/Dashboard/Models/ModelStoreAction.ts')
    const routes = source('storage/framework/defaults/routes/dashboard-api.ts')

    expect(action).toContain("resolveWritableModel(String(")
    expect(action).toContain("'store')")
    expect(action).toContain('await resolved.Model.create(toSnakeCaseKeys(data))')
    expect(action).not.toContain('insertInto(')
    expect(routes).toContain("guard(route.post('/models/{slug}', 'Actions/Dashboard/Models/ModelStoreAction'))")
  })

  test('model browser consumes capability and create-field metadata', () => {
    const page = source('storage/framework/defaults/views/dashboard/models/[model].stx')
    const view = source('storage/framework/defaults/resources/components/Dashboard/Models/ModelRecordsDashboard.stx')
    const modal = source('storage/framework/defaults/resources/components/Dashboard/CreateRecordModal.stx')

    expect(page).toContain('<ModelRecordsDashboard />')
    expect(page).not.toContain('<script')
    expect(view).toContain('writeCapabilities.set(data.writeCapabilities')
    expect(view).toContain('createFields.set(data.createFields')
    expect(view).toContain('<CreateRecordModal')
    expect(view).toContain('<Button')
    expect(view).toContain('@submit="createRecord($event)"')
    expect(view).toContain('<ConfirmDialog')
    expect(view).toContain('@confirm="confirmDelete"')
    expect(view).not.toContain('bg-blue-600 hover:bg-blue-500')
    expect(modal).toContain("const fields = useReactiveProp('fields'")
    expect(modal).toContain('<Button')
    expect(modal).toContain('<Select')
    expect(modal).toContain('<Input')
    expect(modal).toContain('@submit.prevent="submit"')
    expect(modal).not.toContain('bg-blue-600 hover:bg-blue-500')
    expect(modal).not.toMatch(/\b(?:document|window)\./)
    expect(modal).not.toContain('/api/data/')
    expect(modal).not.toContain('<svg')
  })
})
