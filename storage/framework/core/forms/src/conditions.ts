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
    const actual = Object.hasOwn(values, rule.field) ? values[rule.field] : undefined
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

/** Resolve controller visibility before using its value, independent of field order. */
export function visibleFields<T extends Pick<FormFieldDefinition, 'name' | 'conditions'> & { position?: number }>(fields: T[], values: Record<string, unknown>): T[] {
  const byName = new Map(fields.map(field => [field.name, field]))
  const visibility = new Map<string, boolean>()
  const resolving = new Set<string>()
  const visible = (field: T): boolean => {
    if (visibility.has(field.name)) return visibility.get(field.name)!
    if (resolving.has(field.name)) throw new RangeError('Form conditions contain a cycle')
    resolving.add(field.name)
    const controllers: Record<string, unknown> = Object.create(null)
    for (const rule of field.conditions?.rules ?? []) {
      const controller = byName.get(rule.field)
      if (controller && visible(controller) && Object.hasOwn(values, rule.field))
        controllers[rule.field] = values[rule.field]
    }
    const result = evaluateConditions(field.conditions, controllers)
    resolving.delete(field.name)
    visibility.set(field.name, result)
    return result
  }
  return fields.filter(visible).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
}
