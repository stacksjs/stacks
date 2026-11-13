import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * The create and edit forms of a model draw their fields with one component
 * (stacksjs/stacks#3256), so a kind of field is drawn once and both forms
 * gain a new kind together.
 */
function source(path: string): string {
  return readFileSync(resolve(path), 'utf8')
}

describe('one set of inputs for both forms', () => {
  const components = 'storage/framework/defaults/resources/components/Dashboard'
  const inputs = source(`${components}/Models/ModelFieldInputs.stx`)

  test('the create page and the edit page both render it', () => {
    for (const page of ['ModelRecordCreate.stx', 'ModelRecordEdit.stx']) {
      const text = source(`${components}/Models/${page}`)
      expect(text).toContain('<ModelFieldInputs ')
      expect(text).toContain('@change="setValue"')
      // No field drawn by the page itself.
      expect(text).not.toMatch(/<input\b|<Input\b|<Select\b|<Textarea\b/)
    }
  })

  test('each kind has its control', () => {
    expect(inputs).toContain(':if="field.type === \'boolean\'"')
    expect(inputs).toContain(':if="field.type === \'enum\'"')
    expect(inputs).toContain(':if="field.type === \'longtext\' || field.type === \'json\'"')
    expect(inputs).toContain(':monospace="field.type === \'json\'"')
    expect(inputs).toContain('return \'datetime-local\'')
    // Switch, select, relation picker, file chooser, Markdown editor,
    // textarea, one-line input: each is named and each shows its refusal.
    expect(inputs.match(/:name="field\.name"/g)).toHaveLength(7)
    expect(inputs.match(/:error="error\(field\)"/g)).toHaveLength(7)
  })

  test('the edit endpoint describes its fields the way the create form\'s are', () => {
    const show = source('storage/framework/defaults/app/Actions/Dashboard/Models/ModelShowAction.ts')
    expect(show).toContain('response.createFields = response.writeCapabilities.create ? formFields() : []')
    // The same fields, then the switches a trait keeps for itself (stacksjs/stacks#3298).
    expect(show).toContain('response.updateFields = response.writeCapabilities.update ? [...formFields(), ...modelSwitchFields(Model)] : []')
    const edit = source(`${components}/Models/ModelRecordEdit.stx`)
    expect(edit).toContain('const start = modelFormValues(loaded.fields, loaded.row)')
    expect(edit).toContain('const fields = modelFormPayload(current.fields, values(), initial())')
  })

  test('the pages call the model by its name in words', () => {
    const record = source('storage/framework/defaults/functions/dashboard-model-record.ts')
    expect(record.match(/modelName: data\.modelLabel \|\| data\.modelName \|\| 'Record',/g)).toHaveLength(2)
    const browser = source(`${components}/Models/ModelRecordsDashboard.stx`)
    expect(browser).toContain('modelName.set(data.modelLabel ?? data.modelName ?? \'\')')
    // The class name stays where a developer is told what was looked for.
    expect(browser).toContain('Looked for an ORM model named <code :text="modelClass()"></code>')
  })
})
