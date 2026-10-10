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

export function parseTextInput(value: unknown, field: string, required = false, maxLength?: number): string | null {
  if (value == null && !required) return null
  if (typeof value !== 'string') throw new InputValidationError(`${field} must be text`)
  const text = value.trim()
  if (maxLength !== undefined && text.length > maxLength) throw new InputValidationError(`${field} is too long`)
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
  const attributes = model.getDefinition().attributes ?? {}
  for (const [field, value] of Object.entries(values)) {
    const attribute = Object.prototype.hasOwnProperty.call(attributes, field) ? field : Object.keys(attributes).find(key => key === field || key.replace(/([a-z\d])([A-Z])/g, '$1_$2').replace(/([A-Z])([A-Z][a-z])/g, '$1_$2').toLowerCase() === field)
    const rule = attribute ? attributes[attribute]?.validation?.rule : undefined
    if (rule && !rule.validate(value).valid) throw new InputValidationError(`Invalid ${field.replaceAll('_', ' ')}`)
  }
}

/** Exact enum membership without turning objects or numbers into text. */
export function parseEnumInput<const T extends readonly string[]>(value: unknown, field: string, choices: T): T[number] {
  if (typeof value !== 'string' || !choices.includes(value)) throw new InputValidationError(`${field} must be ${choices.join(', ')}`)
  return value as T[number]
}

/** Decode SQL/form booleans. The caller explicitly chooses the fallback for absent or corrupt data. */
export function storedBoolean(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback
  try { return parseBooleanInput(value, 'Stored value') ?? fallback }
  catch (error) {
    if (error instanceof InputValidationError) return fallback
    throw error
  }
}

/** The nullable adapter for record serializers and optional identifiers. */
export function positiveIdOrNull(value: unknown): number | null {
  try { return parsePositiveId(value) }
  catch (error) {
    if (error instanceof InputValidationError) return null
    throw error
  }
}
