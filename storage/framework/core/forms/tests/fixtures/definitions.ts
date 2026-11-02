import type { FormDefinition, FormFieldDefinition, FormFieldType, FormSettings } from '../../src/types'

export function field(name: string, type: FormFieldType = 'text', overrides: Partial<FormFieldDefinition> = {}): FormFieldDefinition {
  return { name, label: name, type, required: true, position: 0, width: 'full', options: {}, conditions: null, ...overrides }
}
export function form(fields: FormFieldDefinition[], settings: FormSettings = {}): FormDefinition {
  return { id: 1, uuid: 'audit', siteId: 1, name: 'Audit', handle: 'audit', status: 'active', fields, settings }
}
