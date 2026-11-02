import type { ValidationErrors, ValidationType, Validator } from '@stacksjs/ts-validation'
import { basename, relative } from 'node:path'
import { existsSync } from 'node:fs'
import type { Model } from '@stacksjs/types'
import { HttpError } from '@stacksjs/error-handling/http-error'
import { path } from '@stacksjs/path'
import { snakeCase } from '@stacksjs/strings/case'
import { getErrorMessage } from '@stacksjs/utils/errors'
import type { FieldMessages } from './messages'
import { applyFieldMessages } from './messages'
// Import directly from sibling files instead of the package's own `./` (which
// would self-circular through `index.ts`'s re-exports and leave `schema` as
// an empty namespace placeholder for any consumer that arrives mid-eval).
import { beginValidation, reportError } from './reporter'
import { schema } from './schema'

export { validate } from './request-validator'
export type { ValidationRules, ValidateOptions } from './request-validator'

// Inlined glob helper. Importing `globSync` from `@stacksjs/storage` would
// pull in the storage facade, which statically imports `@stacksjs/config`.
// `@stacksjs/config` has top-level await on every `~/config/*.ts`, including
// `~/config/env`, which imports this very `@stacksjs/validation` package —
// creating a static-import cycle through async config loading. The cycle
// leaves `@stacksjs/router` (and anything else loaded later that goes
// through @stacksjs/storage) in a TDZ state. Bun.Glob is what storage's
// `globSync` wraps anyway; using it here makes validation truly leaf-node.
function globSync(patterns: string[], options: { absolute?: boolean } = {}): string[] {
  const results: string[] = []
  for (const pattern of patterns) {
    const isAbs = pattern.startsWith('/')
    const slash = isAbs ? pattern.lastIndexOf('/') : -1
    // Split into a base directory the glob walks from and a relative pattern
    // it matches against. `Bun.Glob` doesn't accept absolute patterns, so for
    // absolute inputs we anchor to the deepest static prefix.
    const wildcardAt = pattern.indexOf('*')
    const splitAt = wildcardAt === -1 ? slash : pattern.lastIndexOf('/', wildcardAt)
    const cwd = splitAt > 0 ? pattern.slice(0, splitAt) : '.'
    const rel = splitAt > 0 ? pattern.slice(splitAt + 1) : pattern
    // A directory that does not exist holds no matches. `scanSync` throws
    // ENOENT for one, so an app with no `app/Models` of its own could not
    // validate against a default model at all.
    if (!existsSync(cwd))
      continue
    const glob = new Bun.Glob(rel)
    for (const match of glob.scanSync({ cwd, onlyFiles: true })) {
      results.push(options.absolute ? `${cwd}/${match}` : match)
    }
  }
  return results
}

interface RequestData {
  [key: string]: any
}

interface ValidationField {
  rule: ValidationType
  message: Record<string, string>
}

interface CustomAttributes {
  [key: string]: ValidationField
}

export function isObjectNotEmpty(obj: object | undefined): boolean {
  if (obj === undefined)
    return false

  return Object.keys(obj).length > 0
}

/**
 * Flatten a validation result into the reporter's message shape.
 *
 * `ValidationErrors` is `ValidationError[] | ValidationErrorMap`, and a
 * `ValidationError` is just `{ message }` - so passing it straight to
 * `reportError`, which stores `{ message, value, field }[]`, dropped the field
 * name and the offending value on every failure. In the map form the field is
 * the key, which is the only place it exists at all.
 */
function toMessageObjects(
  errors: ValidationErrors,
  params: RequestData,
): { message: string, value: string, field: string }[] {
  const valueFor = (field: string): string => {
    const value = (params as Record<string, unknown>)[field]
    return value === undefined || value === null ? '' : String(value)
  }

  if (Array.isArray(errors))
    return errors.map(error => ({ message: error.message, value: '', field: '' }))

  return Object.entries(errors).flatMap(([field, fieldErrors]: [string, { message: string }[]]) =>
    fieldErrors.map(error => ({ message: error.message, value: valueFor(field), field })),
  )
}

export async function validateField(modelFile: string, params: RequestData): Promise<any> {
  beginValidation()
  const name = modelFile.replace(/\\/g, '/').replace(/\.ts$/, '')
  if (!name || name.startsWith('/') || name.split('/').some(segment => !segment || segment === '.' || segment === '..')) throw new HttpError(404, 'Model not found')
  const files = new Map<string, string>()
  for (const root of [path.userModelsPath(), path.defaultsPath('app/Models')]) {
    for (const file of globSync([`${root}/**/*.ts`], { absolute: true })) {
      const key = relative(root, file).replace(/\\/g, '/')
      if (!files.has(key)) files.set(key, file)
    }
  }
  const exact = files.get(`${name}.ts`)
  const matches = exact ? [exact] : name.includes('/') ? [] : [...files.values()].filter(file => basename(file) === `${name}.ts`)
  if (matches.length > 1) throw new HttpError(500, `Model ${name} is ambiguous; use its qualified path`)
  const modelPath = matches[0]
  if (!modelPath) throw new HttpError(404, `Model ${name} not found`)

  const model = (await import(modelPath)).default as Model
  const attributes = model.attributes
  const input: RequestData = Object.assign(Object.create(null), params)

  const ruleObject: Record<string, Validator<any>> = Object.create(null)
  // Applied to the errors afterwards (see `./messages`): registered with
  // ts-validation's process-wide provider as `name.min` they were never found,
  // and every call replaced whatever provider the app had set.
  const messages: Record<string, FieldMessages> = Object.create(null)

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const attributeKey = attributes[key]
      if (!attributeKey)
        continue

      const isRequired = 'isRequired' in (attributeKey.validation?.rule ?? {})
        ? (attributeKey.validation?.rule as Validator<any>).isRequired
        : false

      const field = snakeCase(key)
      // Match the ORM write path when both spellings are supplied.
      if (Object.hasOwn(params, key)) input[field] = params[key]
      if (Object.hasOwn(input, field)) input[key] = input[field]
      // Defaults only excuse absence, never a supplied invalid value.
      if (attributeKey.default !== undefined && isRequired === false && !Object.hasOwn(input, field))
        continue

      ruleObject[snakeCase(key)] = attributeKey.validation?.rule as Validator<any>

      const validatorMessages = attributeKey.validation?.message
      if (validatorMessages)
        messages[snakeCase(key)] = validatorMessages as FieldMessages
    }
  }

  try {
    const validator = schema.object(ruleObject)
    const result = await validator.validate(input)
    applyMessages(result, ruleObject, messages, input)

    if (!result.valid) {
      reportError(toMessageObjects(result.errors, input))
      throw new HttpError(422, 'Validation failed', { errors: result.errors })
    }

    return result
  }
  catch (error: unknown) {
    if (isHttpErrorLike(error))
      throw error

    throw new HttpError(500, getErrorMessage(error) || 'An unexpected validation error occurred')
  }
}

/**
 * Async validation rule type.
 * Return true if valid, or a string error message if invalid.
 */
// eslint-disable-next-line pickier/no-unused-vars
export type AsyncValidator = (value: unknown, params: RequestData) => Promise<boolean | string>

// Custom rule registry
const customRuleRegistry = new Map<string, AsyncValidator>()

/**
 * Register a custom validation rule that can be referenced by name.
 */
export function registerRule(name: string, rule: AsyncValidator): void {
  customRuleRegistry.set(name, rule)
}

/**
 * Get a registered custom rule by name.
 */
export function getCustomRule(name: string): AsyncValidator | undefined {
  return customRuleRegistry.get(name)
}

/**
 * Built-in async rule: checks that a value is unique in a database table.
 */
export function unique(table: string, column: string, exceptId?: number): AsyncValidator {
  return async (value: unknown): Promise<boolean | string> => {
    const { db } = await import('@stacksjs/database/runtime')
    let query: any = db.selectFrom(table).where(column, '=', value)
    if (exceptId !== undefined) query = query.where('id', '!=', exceptId)
    const existing = await query.selectAll().executeTakeFirst()
    return existing ? `The ${column} has already been taken` : true
  }
}

/**
 * Built-in async rule: checks that a value exists in a database table.
 */
export function exists(table: string, column: string): AsyncValidator {
  return async (value: unknown): Promise<boolean | string> => {
    const { db } = await import('@stacksjs/database/runtime')
    const existing = await db.selectFrom(table).where(column, '=', value).selectAll().executeTakeFirst()
    return existing ? true : `The selected ${column} does not exist`
  }
}

/**
 * Validate fields with both sync rules (from model) and async rules.
 * Runs sync validation first, then async rules, combining all errors.
 */
export async function validateFieldAsync(
  modelFile: string,
  params: RequestData,
  asyncRules?: Record<string, AsyncValidator>,
): Promise<any> {
  // Run sync validation first
  const syncResult = await validateField(modelFile, params)

  // Then run async rules if provided
  if (asyncRules && Object.keys(asyncRules).length > 0) {
    const asyncErrors: Record<string, string> = Object.create(null)

    await Promise.all(
      Object.entries(asyncRules).map(async ([field, validator]) => {
        const result = await validator(params[field], params)
        if (result !== true) {
          asyncErrors[field] = typeof result === 'string' ? result : `${field} validation failed`
        }
      }),
    )

    if (Object.keys(asyncErrors).length > 0) {
      reportError(Object.entries(asyncErrors).map(([field, message]) => ({ field, message, value: String(params[field] ?? '') })))
      throw new HttpError(422, 'Validation failed', { errors: asyncErrors })
    }
  }

  return syncResult
}

export async function customValidate(attributes: CustomAttributes, params: RequestData): Promise<any> {
  beginValidation()
  const ruleObject: Record<string, Validator<any>> = Object.create(null)
  // Built and then never handed to anything, so these were dropped too.
  const messages: Record<string, FieldMessages> = Object.create(null)

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const rule = attributes[key]?.rule
      if (rule)
        ruleObject[key] = rule as Validator<any>

      const validatorMessages = attributes[key]?.message
      if (validatorMessages)
        messages[key] = validatorMessages
    }
  }

  try {
    const validator = schema.object().shape(ruleObject)
    const result = await validator.validate(params)
    applyMessages(result, ruleObject, messages, params)

    if (!result.valid)
      throw new HttpError(422, 'Validation failed', { errors: result.errors })

    return result
  }
  catch (error: unknown) {
    if (isHttpErrorLike(error))
      throw error

    throw new HttpError(500, getErrorMessage(error) || 'An unexpected validation error occurred')
  }
}
/** Put each field's custom messages on its errors, in place. */
function applyMessages(
  result: { valid: boolean, errors?: unknown },
  rules: Record<string, Validator<any>>,
  messages: Record<string, FieldMessages>,
  params: RequestData,
): void {
  if (result.valid || !result.errors || Array.isArray(result.errors))
    return
  applyFieldMessages(result.errors as Record<string, { message: string }[]>, rules, messages, params)
}

function isHttpErrorLike(error: unknown): error is Error & { status: number } {
  return error instanceof HttpError
    || (error instanceof Error
      && typeof (error as Error & { status?: unknown }).status === 'number')
}
