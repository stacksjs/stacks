import type { ValidationType, Validator } from '@stacksjs/ts-validation'
import type { Model } from '@stacksjs/types'
import { HttpError } from '@stacksjs/error-handling'
import { path } from '@stacksjs/path'
import { snakeCase } from '@stacksjs/strings'
import { MessageProvider, setCustomMessages } from '@stacksjs/ts-validation'
// Import directly from sibling files instead of the package's own `./` (which
// would self-circular through `index.ts`'s re-exports and leave `schema` as
// an empty namespace placeholder for any consumer that arrives mid-eval).
import { reportError } from './reporter'
import { schema } from './schema'

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

export async function validateField(modelFile: string, params: RequestData): Promise<any> {
  const modelFiles = globSync([path.userModelsPath('*.ts'), path.storagePath('framework/defaults/app/Models/**/*.ts')], { absolute: true })
  const modelPath = modelFiles.find(file => file.endsWith(`${modelFile}.ts`))

  if (!modelPath)
    throw new HttpError(404, `Model ${modelFile} not found`)

  const model = (await import(modelPath)).default as Model
  const attributes = model.attributes

  const ruleObject: Record<string, Validator<any>> = {}
  const messageObject: Record<string, string> = {}

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const attributeKey = attributes[key]

      const isRequired = 'isRequired' in (attributeKey.validation?.rule ?? {})
        ? (attributeKey.validation?.rule as Validator<any>).isRequired
        : false

      // Skip validation if the attribute has a default value and is not required
      if (attributeKey.default !== undefined && isRequired === false)
        continue

      ruleObject[snakeCase(key)] = attributeKey.validation?.rule as Validator<any>

      const validatorMessages = attributes[key]?.validation?.message

      if (validatorMessages) {
        for (const validatorMessageKey in validatorMessages) {
          const validatorMessageString = `${key}.${validatorMessageKey}`
          messageObject[validatorMessageString] = validatorMessages[validatorMessageKey] || ''
        }
      }
    }
  }

  try {
    setCustomMessages(new MessageProvider(messageObject))

    const validator = schema.object(ruleObject)
    const result = await validator.validate(params)

    if (!result.valid) {
      reportError(result.errors as any)
      throw new HttpError(422, JSON.stringify(result.errors))
    }

    return result
  }
  catch (error: any) {
    if (error instanceof HttpError)
      throw error

    throw new HttpError(500, error?.message || 'An unexpected validation error occurred')
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
    try {
      const { db } = await import('@stacksjs/database')
      let query = db.selectFrom(table as any).where(column as any, '=', value as any)
      if (exceptId) query = query.where('id' as any, '!=', exceptId as any)
      const existing = await (query as any).selectAll().executeTakeFirst()
      return existing ? `The ${column} has already been taken` : true
    }
    catch {
      // If database is not available, skip async validation
      return true
    }
  }
}

/**
 * Built-in async rule: checks that a value exists in a database table.
 */
export function exists(table: string, column: string): AsyncValidator {
  return async (value: unknown): Promise<boolean | string> => {
    try {
      const { db } = await import('@stacksjs/database')
      const existing = await (db.selectFrom(table as any).where(column as any, '=', value as any) as any).selectAll().executeTakeFirst()
      return existing ? true : `The selected ${column} does not exist`
    }
    catch {
      return true
    }
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
    const asyncErrors: Record<string, string> = {}

    await Promise.all(
      Object.entries(asyncRules).map(async ([field, validator]) => {
        const result = await validator(params[field], params)
        if (result !== true) {
          asyncErrors[field] = typeof result === 'string' ? result : `${field} validation failed`
        }
      }),
    )

    if (Object.keys(asyncErrors).length > 0) {
      throw new HttpError(422, JSON.stringify(asyncErrors))
    }
  }

  return syncResult
}

export async function customValidate(attributes: CustomAttributes, params: RequestData): Promise<any> {
  const ruleObject: Record<string, Validator<any>> = {}
  const messageObject: Record<string, string> = {}

  for (const key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const rule = attributes[key]?.rule
      if (rule)
        ruleObject[key] = rule as Validator<any>

      const validatorMessages = attributes[key]?.message

      for (const validatorMessageKey in validatorMessages) {
        const validatorMessageString = `${key}.${validatorMessageKey}`
        messageObject[validatorMessageString] = attributes[key]?.message[validatorMessageKey] || ''
      }
    }
  }

  try {
    const validator = schema.object().shape(ruleObject)
    const result = await validator.validate(params)

    if (!result.valid)
      throw new HttpError(422, JSON.stringify(result.errors))

    return result
  }
  catch (error: any) {
    if (error instanceof HttpError)
      throw error

    throw new HttpError(500, error?.message || 'An unexpected validation error occurred')
  }
}
