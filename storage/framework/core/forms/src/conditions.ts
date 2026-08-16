import type { FieldConditions, FormFieldDefinition } from './types'

/**
 * Evaluate one field's visibility rules against the submitted values.
 * No conditions = visible. The same function runs client-side for UX and
 * server-side for correctness - the SERVER evaluation is the one that
 * counts: a hidden required field is not required, and values submitted
 * for hidden fields are discarded, so a tampered client can neither skip
 * a required visible field nor smuggle values through a hidden one.
 */
export function evaluateConditions(conditions: FieldConditions | null | undefined, values: Record<string, unknown>): boolean {
  if (!conditions || conditions.rules.length === 0)
    return true

  const results = conditions.rules.map((rule) => {
    const actual = values[rule.field]
    switch (rule.op) {
      case 'eq': return String(actual ?? '') === String(rule.value ?? '')
      case 'neq': return String(actual ?? '') !== String(rule.value ?? '')
      case 'contains': return String(actual ?? '').includes(String(rule.value ?? ''))
      case 'gt': return Number(actual) > Number(rule.value)
      case 'lt': return Number(actual) < Number(rule.value)
      case 'empty': return actual === undefined || actual === null || String(actual) === ''
      case 'not_empty': return actual !== undefined && actual !== null && String(actual) !== ''
      default: return false
    }
  })

  const matched = conditions.logic === 'all' ? results.every(Boolean) : results.some(Boolean)
  return conditions.action === 'show' ? matched : !matched
}

/** The fields visible for a given value set, in position order. */
export function visibleFields(fields: FormFieldDefinition[], values: Record<string, unknown>): FormFieldDefinition[] {
  return fields
    .filter(field => evaluateConditions(field.conditions, values))
    .sort((a, b) => a.position - b.position)
}
