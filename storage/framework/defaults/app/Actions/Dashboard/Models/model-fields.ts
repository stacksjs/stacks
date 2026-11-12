/**
 * What a model says about how one of its fields is shown and asked for in
 * the dashboard: its heading, the help under its input, how its value reads
 * ("$12.00" for 1200, "1.5 KB" for 1536) and which text input it gets.
 *
 * A model's definition says what a field is. It cannot say that `amount` is
 * money and `sizeBytes` is a size: both are numbers. `dashboard.fields` is
 * where the model says so, one field at a time, and everything it leaves out
 * stays derived. This file only reads the declaration; `./model-write` is
 * what applies it, since that is where a field's kind and columns are known.
 */
import { belongsToRelations } from './model-relations'

/** How a stored value is shown. */
export const MODEL_FIELD_FORMATS = ['badge', 'bytes', 'code', 'date', 'datetime', 'duration', 'image', 'link', 'money', 'number', 'percent', 'text'] as const
export type ModelFieldFormat = typeof MODEL_FIELD_FORMATS[number]

/** The text inputs a field of text can be given instead of the one derived for it. */
export const MODEL_FIELD_INPUTS = ['email', 'longtext', 'text', 'url'] as const
export type ModelFieldInput = typeof MODEL_FIELD_INPUTS[number]

/** A format, with what it needs to be read: the currency of an amount, the unit of a duration. */
export interface ModelFieldDisplay {
  format: ModelFieldFormat
  /** For `money`: the ISO code every amount is in. */
  currency?: string
  /** For `money`: the column that holds each row's own ISO code. Wins over `currency` for a row that has one. */
  currencyColumn?: string
  /** For `duration`: what the stored number counts. Milliseconds unless said. */
  unit?: 'ms' | 's'
}

export interface ModelFieldOverride {
  /** The name as the model wrote it, for a message about it. */
  declared: string
  label?: string
  help?: string
  display?: ModelFieldDisplay
  input?: ModelFieldInput
}

function snakeCase(name: string): string {
  return name
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

const parsed = new WeakMap<object, { fields: Record<string, ModelFieldOverride>, problems: string[] }>()

function list(values: readonly string[]): string {
  return values.join(', ')
}

/**
 * The model's `dashboard.fields`, by column, with what is wrong with the
 * parts it declares badly.
 *
 * A name is an attribute (`createdAt`), its column (`created_at`), or a
 * `belongsTo` (`team` for `team_id`), as in `dashboard.columns`. A setting
 * that cannot be read is dropped on its own and said so: a misspelled format
 * does not cost the field its heading.
 */
export function modelFieldOverrides(Model: any): { fields: Record<string, ModelFieldOverride>, problems: string[] } {
  const cached = Model && (typeof Model === 'object' || typeof Model === 'function') ? parsed.get(Model) : undefined
  if (cached)
    return cached

  const fields: Record<string, ModelFieldOverride> = {}
  const problems: string[] = []
  const declared = Model?.dashboard?.fields
  const result = { fields, problems }
  if (declared === undefined || declared === null)
    return result
  if (typeof declared !== 'object' || Array.isArray(declared)) {
    problems.push('dashboard.fields is not an object keyed by field name')
    return result
  }

  const relations = belongsToRelations(Model)
  for (const [name, settings] of Object.entries(declared as Record<string, any>)) {
    const called = `'${name}'`
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      problems.push(`${called} is not an object of settings`)
      continue
    }
    const own = snakeCase(name)
    const relation = relations.find(candidate => candidate.column === own || candidate.column === `${own}_id` || snakeCase(candidate.model) === own)
    const override: ModelFieldOverride = { declared: name }

    if (settings.label !== undefined) {
      if (typeof settings.label === 'string' && settings.label.trim())
        override.label = settings.label.trim()
      else
        problems.push(`${called} has a label that is not text`)
    }
    if (settings.help !== undefined) {
      if (typeof settings.help === 'string' && settings.help.trim())
        override.help = settings.help.trim()
      else
        problems.push(`${called} has help that is not text`)
    }
    if (settings.input !== undefined) {
      if (MODEL_FIELD_INPUTS.includes(settings.input))
        override.input = settings.input
      else
        problems.push(`${called} asks for an input the dashboard does not have: '${String(settings.input)}' (it has ${list(MODEL_FIELD_INPUTS)})`)
    }
    if (settings.format !== undefined) {
      if (MODEL_FIELD_FORMATS.includes(settings.format))
        override.display = { format: settings.format }
      else
        problems.push(`${called} asks for a format the dashboard does not have: '${String(settings.format)}' (it has ${list(MODEL_FIELD_FORMATS)})`)
    }

    const display = override.display
    if (settings.currency !== undefined) {
      if (display?.format !== 'money')
        problems.push(`${called} names a currency, which only \`format: 'money'\` reads`)
      else if (typeof settings.currency === 'string' && /^[A-Z]{3}$/i.test(settings.currency.trim()))
        display.currency = settings.currency.trim().toUpperCase()
      else
        problems.push(`${called} names a currency that is not a three-letter code: '${String(settings.currency)}'`)
    }
    if (settings.currencyField !== undefined) {
      if (display?.format !== 'money')
        problems.push(`${called} names a currency field, which only \`format: 'money'\` reads`)
      else if (typeof settings.currencyField === 'string' && /^[A-Z_]\w*$/i.test(settings.currencyField.trim()))
        display.currencyColumn = snakeCase(settings.currencyField.trim())
      else
        problems.push(`${called} names a currency field that is not a field name`)
    }
    if (settings.unit !== undefined) {
      if (display?.format !== 'duration')
        problems.push(`${called} names a unit, which only \`format: 'duration'\` reads`)
      else if (settings.unit === 'ms' || settings.unit === 's')
        display.unit = settings.unit
      else
        problems.push(`${called} names a unit that is not 'ms' or 's': '${String(settings.unit)}'`)
    }

    fields[relation ? relation.column : own] = override
  }

  if (Model && (typeof Model === 'object' || typeof Model === 'function'))
    parsed.set(Model, result)
  return result
}
