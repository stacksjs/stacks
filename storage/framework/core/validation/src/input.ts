/** Validation failures at a custom action boundary retain their HTTP status. */
export class InputValidationError extends Error {
  readonly status = 422
}

export async function readJsonObject(request: { json: () => Promise<unknown> }): Promise<Record<string, unknown>> {
  let body: unknown
  try { body = await request.json() }
  catch { throw new InputValidationError('Send a valid JSON object') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new InputValidationError('Send a JSON object')
  return body as Record<string, unknown>
}

export function parsePositiveId(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') throw new InputValidationError('Invalid identifier')
  const id = Number(value)
  if (!Number.isSafeInteger(id) || id <= 0) throw new InputValidationError('Invalid identifier')
  return id
}

export function parseTextInput(value: unknown, field: string, required = false): string | null {
  if (value == null && !required) return null
  if (typeof value !== 'string') throw new InputValidationError(`${field} must be text`)
  const text = value.trim()
  if (!text && required) throw new InputValidationError(`${field} is required`)
  return text || null
}

export function parseNumberInput(value: unknown, field: string, min: number, max: number, integer = false): number | null {
  if (value == null || value === '') return null
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) throw new InputValidationError(`${field} must be a number`)
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max || (integer && !Number.isSafeInteger(number))) throw new InputValidationError(`${field} is out of range`)
  return number
}

/** Supports form booleans without treating arbitrary text or objects as consent. */
export function parseBooleanInput(value: unknown, field: string): boolean | undefined {
  if (value === undefined) return undefined
  if (value === true || value === 'true' || value === 1 || value === '1') return true
  if (value === false || value === 'false' || value === 0 || value === '0') return false
  throw new InputValidationError(`${field} must be a boolean`)
}

export interface InputValidatableModel {
  getDefinition: () => { attributes?: Record<string, { validation?: { rule?: { validate(value: unknown): { valid: boolean } } } }> }
}

/** Validate supplied fields only, so partial updates use the model's own rules. */
export function validateModelInput(model: InputValidatableModel, values: Record<string, unknown>): void {
  for (const [field, value] of Object.entries(values)) {
    const rule = model.getDefinition().attributes?.[field]?.validation?.rule
    if (rule && !rule.validate(value).valid) throw new InputValidationError(`Invalid ${field.replaceAll('_', ' ')}`)
  }
}
