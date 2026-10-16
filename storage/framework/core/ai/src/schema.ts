/** Shared JSON shape validation for AI output and MCP input. Supports type, enum, const,
 * properties, required, additionalProperties:false, items, bounds and pattern.
 * This is a constrained schema vocabulary, not a general JSON Schema engine. */
function typeMatches(value: unknown, type: string): boolean {
  if (type === 'array') return Array.isArray(value)
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value)
  if (type === 'null') return value === null
  return typeof value === type && (type !== 'number' || Number.isFinite(value))
}

export function validateSchema(value: unknown, schema: Record<string, any>, path = '$'): string[] {
  const errors: string[] = []
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!allowed.some((type: string) => typeMatches(value, type)))
      return [`${path} must be ${allowed.join(' or ')}`]
  }
  if (Object.hasOwn(schema, 'const') && !Object.is(schema.const, value))
    errors.push(`${path} must equal ${String(schema.const)}`)
  if (schema.enum && !schema.enum.some((candidate: unknown) => Object.is(candidate, value)))
    errors.push(`${path} must be one of ${schema.enum.join(', ')}`)
  if (typeof value === 'string') {
    if (schema.pattern && !new RegExp(schema.pattern).test(value))
      errors.push(`${path} does not match the required pattern`)
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push(`${path} must contain at least ${schema.minLength} characters`)
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      errors.push(`${path} must contain at most ${schema.maxLength} characters`)
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${path} must be at least ${schema.minimum}`)
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${path} must be at most ${schema.maximum}`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push(`${path} must contain at least ${schema.minItems} items`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${path} must contain at most ${schema.maxItems} items`)
    if (schema.items) {
      value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, `${path}[${index}]`)))
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(record, key))
        errors.push(`${path}.${key} is required`)
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (Object.hasOwn(record, key))
        errors.push(...validateSchema(record[key], child as Record<string, any>, `${path}.${key}`))
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys(schema.properties ?? {}))
      for (const key of Object.keys(record)) {
        if (!known.has(key))
          errors.push(`${path}.${key} is not allowed`)
      }
    }
  }
  return errors
}

