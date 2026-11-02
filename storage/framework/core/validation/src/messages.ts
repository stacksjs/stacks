/**
 * Custom validation messages, put on the errors they name.
 *
 * A rule definition's `message` is one string for any failure of its field, or
 * an object keyed by rule name (`{ min: 'Name is too short' }`), as the models
 * and the actions guide write it. A key that is the field's own name answers
 * for any failure no rule name matched, which the action layer has always done,
 * unless the field's validator has a rule of that name: `email: { email: ... }`
 * is the email rule's message, and a required failure keeps its own.
 *
 * ts-validation reports a failure as a bare `{ message }` and looks custom
 * messages up in one process-wide provider by the validator's `fieldName`,
 * which stays `"value"` unless something sets it. So none of the paths that
 * carried these messages found them: `validate()` and `validateField()`
 * registered `name.min` with that provider, the action layer looked the object
 * up by field name only, and the ORM's write check by an error `code` there is
 * none of. Failure names are captured by structural validators or matched to
 * the provider's rendered messages, without running predicates again.
 */

/** A field's custom messages: one for any failure, or one per rule name. */
export type FieldMessages = string | Readonly<Record<string, string>>

interface RuleLike {
  name?: string
  isRequired?: boolean
  fieldName?: string
  getRules?: () => ReadonlyArray<{ name?: string, message?: string, params?: Record<string, any> }>
}

/**
 * The name a message is keyed by for the validator's `index`th rule.
 *
 * A validator's first rule is its type check, named after it (`string`,
 * `number`, `unix`), except that `timestamp()` and `date()` call theirs
 * `custom`; a model writes `timestamp:` for it, so that is the key.
 */
function keyFor(validator: RuleLike, name: string | undefined, index: number): string | undefined {
  return name === 'custom' && index === 0 && typeof validator.name === 'string' && validator.name !== 'custom'
    ? validator.name
    : name
}

/**
 * The keys a message object for this validator can use: its rules' names,
 * `required` when it is required. Empty when the validator cannot say.
 */
export function messageKeys(rule: unknown): Set<string> {
  const validator = rule as RuleLike | null | undefined
  if (!validator || typeof validator.getRules !== 'function')
    return new Set()
  const names = new Set(validator.getRules().map((entry, index) => keyFor(validator, entry?.name, index)).filter((name): name is string => typeof name === 'string'))
  if (validator.isRequired)
    names.add('required')
  return names
}

interface ReportedError { message: string }
const failureKey = Symbol.for('stacks.validation.failureNames')
const failureNames = ((globalThis as Record<symbol, unknown>)[failureKey] ??= new WeakMap<object, string | undefined>()) as WeakMap<object, string | undefined>

/** Preserve a structural validator's known failure without inferring it from text. */
export function validationFailure(message: string, name: string): ReportedError {
  const error = { message }
  failureNames.set(error, name)
  return error
}

/** Identify failures from the provider's rendered messages, without invoking tests or mutating schemas. */
function namesFromErrors(rule: RuleLike, value: unknown, errors: ReadonlyArray<ReportedError>): Array<string | undefined> {
  // Resolve the provider only for failures that need a per-rule message.
  const { getCustomMessages } = require('@stacksjs/ts-validation') as typeof import('@stacksjs/ts-validation')
  const provider = getCustomMessages()
  if (rule.isRequired && (value === undefined || value === null || value === '')) {
    const message = provider.getMessage('required', undefined, rule.fieldName)
    return errors.map(error => error.message === message ? 'required' : undefined)
  }
  const candidates = (rule.getRules?.() ?? []).map((entry, index) => ({
    key: keyFor(rule, entry.name, index),
    message: entry.name ? provider.getMessage(entry.name, entry.message, rule.fieldName, entry.params) : entry.message,
  }))
  return errors.map((error) => {
    const names = new Set(candidates.filter(candidate => candidate.message === error.message).map(candidate => candidate.key))
    // Ambiguous messages retain their original text rather than guessing a rule.
    return names.size === 1 ? [...names][0] : undefined
  })
}

/** Capture the effective conditional rule's failure names while its result is available. */
export function validateRule(rule: unknown, value: unknown): { valid: boolean, errors: import('@stacksjs/ts-validation').ValidationErrors } {
  const validator = rule as RuleLike & { validate: (value: unknown) => { valid: boolean, errors: import('@stacksjs/ts-validation').ValidationErrors } }
  const result = validator.validate(value)
  if (result.valid) return result
  const errors = Array.isArray(result.errors) ? result.errors : Object.values(result.errors).flat()
  // Nested object walkers already attached each child's own metadata.
  if (Array.isArray(result.errors) || validator.isRequired && (value === undefined || value === null || value === '')) {
    const names = namesFromErrors(validator, value, errors)
    errors.forEach((error, index) => {
      if (!failureNames.has(error)) failureNames.set(error, names[index])
    })
  }
  return result
}

/** Apply field messages to exact or flattened descendant errors without losing failure metadata. */
export function applyFieldMessages(
  errors: Record<string, ReportedError[]>,
  rules: Record<string, unknown>,
  messages: Record<string, FieldMessages>,
  input: Record<string, unknown>,
): void {
  for (const [field, message] of Object.entries(messages)) {
    for (const key of Object.keys(errors)) {
      if (key !== field && !key.startsWith(`${field}.`)) continue
      // A field-wide string applies to all descendants. Per-rule maps target
      // the field itself, not unrelated rules on its children.
      if (key !== field && typeof message !== 'string') continue
      errors[key] = fieldErrorMessages(rules[field], input[field], errors[key]!, message, field).map(text => ({ message: text }))
    }
  }
}

/**
 * The messages to report for a field whose `rule` failed with `errors`.
 *
 * `format` dresses a validator's own message (the action layer adds the
 * field's label); a custom message is used as written. A repeat is dropped,
 * since a field-wide message can answer for more than one failure.
 */
export function fieldErrorMessages(
  rule: unknown,
  value: unknown,
  errors: ReadonlyArray<{ message: string }>,
  messages: FieldMessages | null | undefined,
  field: string,
  format: (message: string) => string = message => message,
): string[] {
  if (typeof messages === 'string')
    return [messages]
  if (!messages || typeof messages !== 'object')
    return errors.map(error => format(error.message))

  const fallback = errors.some(error => !failureNames.has(error)) ? namesFromErrors((rule ?? {}) as RuleLike, value, errors) : []
  const names = errors.map((error, index) => failureNames.has(error) ? failureNames.get(error) : fallback[index])
  const custom = (key: string | undefined): string | undefined => {
    if (key === undefined || !Object.hasOwn(messages, key))
      return undefined
    const message = (messages as Record<string, unknown>)[key]
    return typeof message === 'string' && message !== '' ? message : undefined
  }
  const fieldWide = messageKeys(rule).has(field) ? undefined : custom(field)
  return [...new Set(errors.map((error, index) => custom(names[index]) ?? fieldWide ?? format(error.message)))]
}
