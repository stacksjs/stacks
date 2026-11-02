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
 * none of. Its validators report a required failure alone, and otherwise one
 * error per failing rule in their order, so the rule behind each error can be
 * read off the validator, with no shared state.
 */

/** A field's custom messages: one for any failure, or one per rule name. */
export type FieldMessages = string | Readonly<Record<string, string>>

interface RuleLike {
  name?: string
  isRequired?: boolean
  getRules?: () => ReadonlyArray<{ name?: string, test?: (value: unknown) => boolean }>
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

/** The rule behind each of a validator's errors, in order, or none when they cannot be told apart. */
function failedRuleNames(rule: unknown, value: unknown, count: number): Array<string | undefined> {
  const validator = rule as RuleLike | null | undefined
  if (!validator || typeof validator.getRules !== 'function')
    return []

  const names = value === undefined || value === null || value === ''
    ? (validator.isRequired ? ['required'] : [])
    : validator.getRules()
        .map((entry, index) => ({ entry, key: keyFor(validator, entry?.name, index) }))
        .filter(({ entry }) => typeof entry?.test === 'function' && !entry.test(value))
        .map(({ key }) => key)
  return names.length === count ? names : []
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

  const names = failedRuleNames(rule, value, errors.length)
  const custom = (key: string | undefined): string | undefined => {
    if (key === undefined || !Object.hasOwn(messages, key))
      return undefined
    const message = (messages as Record<string, unknown>)[key]
    return typeof message === 'string' && message !== '' ? message : undefined
  }
  const fieldWide = messageKeys(rule).has(field) ? undefined : custom(field)
  return [...new Set(errors.map((error, index) => custom(names[index]) ?? fieldWide ?? format(error.message)))]
}
