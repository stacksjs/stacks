/**
 * Database Seeder Module
 *
 * Provides model-based seeding using factory functions defined on model attributes.
 * This module reads models from both the framework defaults (storage/framework/defaults/app/Models)
 * and user-defined models (app/Models/), with user models taking precedence.
 * Generates fake data using the factory functions and faker instance from @stacksjs/faker.
 */

import type { Attribute, Model, SeedOptions } from '@stacksjs/types'
import { existsSync, readdirSync } from 'node:fs'
import { extname, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { log } from '@stacksjs/logging'
// Local relative import — see drivers/mysql.ts for the cycle-deadlock rationale.
import { db, ensureDatabaseConfigLoaded } from './utils'
import { faker } from '@stacksjs/faker'
import { path } from '@stacksjs/path'
import { hashMake } from '@stacksjs/security'
import { fs } from '@stacksjs/storage'

/**
 * Base contract for application seeders stored in `database/seeders`.
 *
 * Application seeders complement model factories with idempotent bootstrap
 * work such as creating an initial workspace or assigning roles.
 */
export abstract class Seeder {
  /**
   * When this seeder runs, relative to its siblings. Lower runs first.
   *
   * Seeders otherwise run in path order, which is alphabetical and has nothing
   * to do with what depends on what. A `ClubSeeder` that needs a user to own
   * the club sorted before `UserSeeder` and quietly seeded nothing — the kind
   * of failure that looks like the seeder being broken rather than early, and
   * that a second `db:seed` "fixes" without explaining anything.
   *
   * Give anything that reads rows another seeder writes a higher number than
   * the one that writes them. Equal values keep their path order, so existing
   * seeders that never set this behave exactly as before.
   *
   * @default 0
   */
  static order = 0

  abstract run(): Promise<void> | void
}

export interface ApplicationSeederResult {
  seeder: string
  file: string
  success: boolean
  error?: string
  duration: number
}

export interface ApplicationSeederSummary {
  total: number
  successful: number
  failed: number
  results: ApplicationSeederResult[]
  duration: number
}

export interface ApplicationSeederConfig {
  /** Directory containing application seeder modules. */
  directory?: string
  /** Whether to output progress and result logs. */
  verbose?: boolean
}

const SEEDER_EXTENSIONS = new Set(['.js', '.mjs', '.ts'])

function applicationSeederFiles(directory: string): string[] {
  if (!existsSync(directory))
    return []

  const files: string[] = []
  const visit = (current: string): void => {
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))

    for (const entry of entries) {
      if (entry.name.startsWith('.'))
        continue

      const file = `${current}/${entry.name}`
      if (entry.isDirectory()) {
        visit(file)
        continue
      }

      if (!entry.isFile() || entry.name.endsWith('.d.ts') || !SEEDER_EXTENSIONS.has(extname(entry.name)))
        continue

      files.push(file)
    }
  }

  visit(directory)
  return files
}

/**
 * Run application seeders from `database/seeders` in deterministic path order.
 *
 * Each module must default-export a class extending {@link Seeder}. Failures
 * are recorded and remaining seeders continue, matching model-factory seeding.
 */
export async function runApplicationSeeders(config: ApplicationSeederConfig = {}): Promise<ApplicationSeederSummary> {
  const startTime = Date.now()
  const directory = config.directory || path.userDatabasePath('seeders')
  const verbose = config.verbose ?? true
  const results: ApplicationSeederResult[] = []

  /*
   * Load every seeder before running any of them, so `Seeder.order` can sort
   * them. Path order alone is alphabetical, which is unrelated to what depends
   * on what: a ClubSeeder needing a user to own the club sorted before
   * UserSeeder and seeded nothing.
   *
   * A module that fails to import is kept in the list with its error so it
   * still reports as a failure rather than vanishing from the summary.
   */
  interface LoadedSeeder {
    file: string
    displayFile: string
    name: string
    order: number
    SeederClass?: any
    loadError?: unknown
  }

  const loaded: LoadedSeeder[] = []
  for (const file of applicationSeederFiles(directory)) {
    const displayFile = relative(directory, file)
    const fallbackName = displayFile.replace(/\.(?:m?js|ts)$/, '')
    try {
      const module = await import(pathToFileURL(file).href)
      const SeederClass = module.default
      const order = typeof SeederClass?.order === 'number' ? SeederClass.order : 0
      loaded.push({ file, displayFile, name: SeederClass?.name || fallbackName, order, SeederClass })
    }
    catch (error) {
      loaded.push({ file, displayFile, name: fallbackName, order: 0, loadError: error })
    }
  }

  // Stable: equal orders keep path order, so seeders that never set `order`
  // behave exactly as they did before this existed.
  loaded.sort((a, b) => a.order - b.order)

  for (const entry of loaded) {
    const startedAt = Date.now()
    const { displayFile } = entry
    let seeder = entry.name

    try {
      if (entry.loadError)
        throw entry.loadError

      const SeederClass = entry.SeederClass

      if (typeof SeederClass !== 'function')
        throw new TypeError('The default export must be a Seeder class.')

      const instance = new SeederClass()
      if (!(instance instanceof Seeder))
        throw new TypeError('The default export must extend Seeder from @stacksjs/database.')

      seeder = SeederClass.name || seeder
      if (verbose)
        log.info(`Running application seeder ${seeder}...`)

      await instance.run()
      results.push({
        seeder,
        file: displayFile,
        success: true,
        duration: Date.now() - startedAt,
      })
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (verbose)
        log.error(`Application seeder ${seeder} failed: ${message}`)

      results.push({
        seeder,
        file: displayFile,
        success: false,
        error: message,
        duration: Date.now() - startedAt,
      })
    }
  }

  return {
    total: results.length,
    successful: results.filter(result => result.success).length,
    failed: results.filter(result => !result.success).length,
    results,
    duration: Date.now() - startTime,
  }
}

/**
 * Returns the path to the framework default models directory
 */
export function defaultModelsPath(subpath?: string): string {
  return path.frameworkPath(`defaults/app/Models/${subpath || ''}`)
}

/**
 * Models that touch live auth state and are unsafe to auto-seed on an
 * already-populated database (stacksjs/stacks#1852).
 *
 * The motivating incident: a userland `app/Models/OauthClient.ts` shipped
 * with the default `useSeeder: { count: 10 }` trait. Every `./buddy seed`
 * re-rolled the `oauth_clients` table — including the row at id=1, the
 * Personal Access Client whose `secret` is part of the encryption key
 * used to derive each issued access token's `encryptedId`. With the
 * secret rotated, every previously-issued token failed validation at
 * `decrypt(encryptedId, clientSecret)`, surfacing as a generic
 * "Unauthorized. Invalid token." 401 with no log line indicating what
 * actually happened.
 *
 * Models on this list are skipped by default. They are seeded when:
 *
 *   - `fresh: true` is passed (the seeder truncates first; live tokens
 *     are gone anyway, so re-rolling the PAC secret is harmless), OR
 *   - `allowProtected: true` is passed (explicit opt-in escape hatch
 *     surfaced as `./buddy seed --allow-protected`).
 *
 * The list is conservative: any model whose rows participate in token
 * issuance / validation / refresh belongs here.
 */
export const PROTECTED_MODELS: readonly string[] = Object.freeze([
  'OauthClient',
  'OauthAccessToken',
  'OauthRefreshToken',
  'PersonalAccessToken',
])

/**
 * Models whose rows are people, not fixtures.
 *
 * A seeded row is allowed to attach itself to a parent that already exists —
 * that is how a seeded flight finds a seeded field. It is not allowed to
 * attach itself to an *account*. These tables hold real sign-ins on any
 * database that is not a scratch copy, and pointing invented rows at them
 * hands one customer another customer's fabricated data: a farmer signs in
 * and finds fields they have never seen, on a holding they do not own.
 *
 * Foreign keys to these models are left null. Which account owns a seeded
 * row is a decision for the app that seeded it (a `demo:account` command, a
 * fixture, a migration), not something a factory should guess.
 *
 * `allowProtected: true` (`./buddy seed --allow-protected`) opts back in.
 */
export const ACCOUNT_MODELS: readonly string[] = Object.freeze([
  'User',
  'Team',
  'Customer',
])

/** Test whether a model holds accounts rather than fixtures. */
export function isAccountModel(name: string): boolean {
  return ACCOUNT_MODELS.includes(name)
}

/**
 * Test whether a model name is on the protected list.
 * Exported for downstream tooling (CI lint rules, custom seeders) so the
 * list stays a single source of truth.
 */
export function isProtectedModel(name: string): boolean {
  return PROTECTED_MODELS.includes(name)
}

/**
 * Convert a camelCase or PascalCase string to snake_case
 * Examples:
 *   companyName -> company_name
 *   billingEmail -> billing_email
 *   isPersonal -> is_personal
 *   createdAt -> created_at
 */
function snakeCase(str: string): string {
  return str
    // Handle acronyms and consecutive uppercase letters
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    // Handle transition from lowercase to uppercase
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    // Deliberately no `(\d)([A-Za-z])` rule. A digit followed by a lowercase
    // letter is not a word boundary: `p256dh` is one token and splitting it
    // yields `p256_dh`, a column name nothing else in the framework derives.
    // `sha256Sum` still splits correctly, on the uppercase rule above, which is
    // the only place a boundary actually is. This matches snakeCase in
    // `@stacksjs/strings`; the two disagreeing is how the generated types and
    // the generated SQL end up naming the same column differently.
    .toLowerCase()
}

/**
 * Seeder configuration options
 */
export interface SeederConfig {
  /** Directory containing model files */
  modelsDir?: string
  /** Default count if not specified in model */
  defaultCount?: number
  /** Whether to output verbose logs */
  verbose?: boolean
  /** Whether to truncate tables before seeding */
  fresh?: boolean
  /** Specific models to seed (by name) */
  only?: string[]
  /** Models to exclude from seeding */
  except?: string[]
  /** Include framework default models even when app/Models contains userland models */
  includeDefaults?: boolean
  /**
   * Bypass the {@link PROTECTED_MODELS} guard and seed auth/oauth models
   * even on a non-fresh database. Use this only when you know the
   * downstream consequence (every issued token will fail validation
   * because the Personal Access Client secret got rotated). Surfaced via
   * `./buddy seed --allow-protected`. (stacksjs/stacks#1852)
   */
  allowProtected?: boolean

  /**
   * Add rows to tables that already have some, instead of skipping them.
   *
   * The default refuses to touch a non-empty table, and `fresh` empties every
   * table first. Neither answers "this database already has real rows in it
   * and I want some seeded ones as well" — the case every demo account on a
   * live deployment runs into, where `fresh` would take the real rows with it.
   */
  append?: boolean
}

/**
 * Result of a single model seeding operation
 */
export interface SeedResult {
  model: string
  table: string
  count: number
  success: boolean
  error?: string
  duration: number
}

/**
 * Result of the entire seeding operation
 */
export interface SeedSummary {
  total: number
  successful: number
  failed: number
  results: SeedResult[]
  duration: number
}

/**
 * Parsed model with seeding information
 */
export interface SeederModel {
  name: string
  table: string
  count: number
  fixtures: Array<Record<string, unknown>>
  attributes: Record<string, Attribute>
  model: Model
  filePath: string
  /**
   * Whether this model opted into the model pass via `traits.useSeeder`.
   *
   * A model that did not is still LOADED when the caller asks for it, because
   * overriding a framework default is decided by a model's identity, not by
   * whether it wants seeding — see `loadAllModels`. Non-seeding entries are
   * filtered out once the merge is done.
   */
  seedable: boolean
}

/**
 * Load all models from a directory (including subdirectories)
 */
async function loadModelsFromDir(modelsDir: string, recursive: boolean = false, includeNonSeeding: boolean = false): Promise<SeederModel[]> {
  const models: SeederModel[] = []

  if (!fs.existsSync(modelsDir)) {
    return models
  }

  const entries = fs.readdirSync(modelsDir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(modelsDir, entry.name)

    // Handle subdirectories recursively if enabled
    if (entry.isDirectory() && recursive) {
      const subModels = await loadModelsFromDir(fullPath, true, includeNonSeeding)
      models.push(...subModels)
      continue
    }

    // Skip non-TypeScript files and special files
    if (!entry.name.endsWith('.ts') || entry.name.startsWith('index') || entry.name.startsWith('_')) {
      continue
    }

    try {
      const module = await import(fullPath)
      const modelDef: Model = module.default || module

      if (!modelDef) {
        continue
      }

      // Check if model has seeding enabled
      const useSeeder = modelDef.traits?.useSeeder ?? modelDef.traits?.seedable
      if (!useSeeder && !includeNonSeeding) {
        continue
      }
      const seedable = Boolean(useSeeder)

      // Get seed count + optional fixture rows (merged over factories)
      let count = 10 // default
      let fixtures: Array<Record<string, unknown>> = []
      if (typeof useSeeder === 'object' && 'count' in useSeeder) {
        const opts = useSeeder as SeedOptions
        count = opts.count
        fixtures = opts.fixtures ?? []
      }

      // Get model name and table name
      const modelName = modelDef.name || entry.name.replace('.ts', '')
      const tableName = modelDef.table || snakeCase(modelName) + 's'

      models.push({
        name: modelName,
        table: tableName,
        count: Math.max(count, fixtures.length),
        fixtures,
        attributes: modelDef.attributes || {},
        model: modelDef,
        filePath: fullPath,
        seedable,
      })
    }
    catch (err) {
      log.error(`Failed to load model ${entry.name}:`, err)
    }
  }

  return models
}

/**
 * Load all models from both default and user directories
 * User models take precedence over default models (override by name)
 */
async function loadAllModels(userModelsDir: string, verbose: boolean = false, includeDefaults: boolean = false): Promise<SeederModel[]> {
  const defaultDir = defaultModelsPath()

  // User models are loaded INCLUDING the ones that never opted into seeding.
  //
  // Overriding a framework default is decided by a model's identity, not by
  // whether it wants seeding. Filtering on `useSeeder` before the merge below
  // meant an app model that overrode a default but left seeding to an
  // application seeder never entered the map — so the DEFAULT of the same name
  // survived, and the model pass inserted the framework's shape into the app's
  // table. An app whose `User` carried no `avatar` column failed with
  // `table users has no column named avatar`, naming a column its own model
  // does not define and pointing at a file the app never wrote.
  const userModels = await loadModelsFromDir(userModelsDir, false, true)

  if (userModels.length > 0 && !includeDefaults) {
    return userModels.filter(model => model.seedable)
  }

  // Load default models when explicitly requested, or as a fallback for apps
  // that have not defined userland models yet.
  const defaultModels = await loadModelsFromDir(defaultDir, true)

  // Create a map with default models, then override with user models
  const modelMap = new Map<string, SeederModel>()

  for (const model of defaultModels) {
    modelMap.set(model.name, model)
  }

  // User models override defaults
  for (const model of userModels) {
    if (modelMap.has(model.name) && verbose) {
      log.info(model.seedable
        ? `  User model "${model.name}" overrides default`
        : `  User model "${model.name}" overrides default and opts out of the model pass`)
    }
    modelMap.set(model.name, model)
  }

  // Now that identity has decided the winner, drop whatever did not ask to be
  // seeded — including a default that an opted-out user model displaced.
  return Array.from(modelMap.values()).filter(model => model.seedable)
}

/**
 * Load all models from the models directory (legacy function for backwards compatibility)
 */
async function loadModels(modelsDir: string): Promise<SeederModel[]> {
  return loadModelsFromDir(modelsDir, false)
}

/**
 * Check if a field is a password field that should be hashed
 */
function isPasswordField(fieldName: string, attr: Attribute): boolean {
  const lowerName = fieldName.toLowerCase()

  // Check field name patterns
  if (lowerName === 'password' || lowerName.endsWith('_password') || lowerName.endsWith('password')) {
    return true
  }

  // Check if the attribute is marked as hidden (common for password fields)
  if (attr.hidden === true && lowerName.includes('pass')) {
    return true
  }

  return false
}

/**
 * Generate a single record using factory functions
 *
 * Note: Field names are converted to snake_case to match database column names.
 * Model attributes use camelCase (e.g., companyName) but database columns
 * use snake_case (e.g., company_name).
 *
 * Password fields are automatically hashed using the configured hashing algorithm.
 */
async function generateRecord(
  attributes: Record<string, Attribute>,
  modelName: string,
  report: boolean = false,
): Promise<Record<string, unknown>> {
  const record: Record<string, unknown> = {}

  for (const [fieldName, attr] of Object.entries(attributes)) {
    // Convert field name to snake_case for database column
    const columnName = snakeCase(fieldName)
    let value: unknown

    // Use factory function if defined
    if (attr.factory && typeof attr.factory === 'function') {
      try {
        // Cast: the faker singleton is a wrapped object that exposes additional helpers
        // beyond the BaseFaker type used in the factory signature.
        value = attr.factory(faker as any)
      }
      catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        if (report) {
          log.warn(`  Factory failed for ${modelName}.${fieldName}: ${errorMsg} - seeding the default instead.`)
        }
        // Use default if available, otherwise use sensible fallbacks based on likely type
        if (attr.default !== undefined) {
          value = attr.default
        }
        else {
          // Try to infer a sensible default
          value = inferDefaultValue(fieldName)
        }
      }
    }
    else if (attr.default !== undefined) {
      value = attr.default
    }
    else {
      // Skip fields without factory or default - they may be nullable or auto-generated
      continue
    }

    // Hash password fields using bcrypt (to match the User model's set.password)
    if (isPasswordField(fieldName, attr) && typeof value === 'string') {
      try {
        value = await hashMake(value, { algorithm: 'bcrypt' })
      }
      catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        // Always: the fallback writes the password in the clear, so nobody can
        // sign in and nothing says why.
        log.warn(`  Failed to hash password for ${modelName}.${fieldName}: ${errorMsg}`)
        // Keep the unhashed value as fallback
      }
    }

    record[columnName] = value
  }

  return record
}

/**
 * Infer a sensible default value based on field name
 */
function inferDefaultValue(fieldName: string): unknown {
  const lowerName = fieldName.toLowerCase()

  // Boolean fields
  if (lowerName.startsWith('is') || lowerName.startsWith('has') || lowerName.endsWith('able')) {
    return false
  }

  // Count/number fields
  if (lowerName.includes('count') || lowerName.includes('amount') || lowerName.includes('quantity')) {
    return 0
  }

  // URL fields
  if (lowerName.includes('url') || lowerName.includes('link')) {
    return 'https://example.com'
  }

  // Email fields
  if (lowerName.includes('email')) {
    return faker.internet.email()
  }

  // Name fields
  if (lowerName.includes('name')) {
    return faker.person.fullName()
  }

  // Default to null for unknown types
  return null
}

/**
 * Generate multiple records for a model
 */
function fixtureToColumns(fixture: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(fixture))
    out[snakeCase(key)] = value
  return out
}

/**
 * The rows already in a parent's table, for pointing a foreign key at.
 *
 * Whole rows rather than bare ids: a parent's own foreign keys are what keep
 * a child's several parents consistent with each other (see below). Empty
 * when the table is missing or empty, in which case the key is left null
 * rather than pointing at a row that does not exist.
 */
async function existingRows(table: string): Promise<Record<string, unknown>[]> {
  try {
    return await db.selectFrom(table).selectAll().limit(500).execute() as Record<string, unknown>[]
  }
  catch {
    return []
  }
}

/**
 * The table each loaded model actually uses, by model name.
 *
 * A parent's table used to be guessed as `snake_case(name) + 's'`, which is
 * wrong for every model whose plural is not formed by adding an s: a
 * `Repository` was looked up in `repositorys`, the query failed, the pool came
 * back empty, and the child's foreign key was left to whatever its factory
 * invented. On a database with foreign keys that is not a subtly wrong graph
 * but a hard constraint violation, so the whole model failed to seed. The
 * models already declare their table; this reads it instead of guessing.
 */
const modelTables = new Map<string, string>()

/** Record the table names of the models about to be seeded. */
export function registerModelTables(models: { name: string, table: string }[]): void {
  modelTables.clear()
  for (const model of models)
    modelTables.set(model.name, model.table)
}

/**
 * The table a parent model lives in.
 *
 * Falls back to the old guess for a parent that is not itself being seeded
 * (a framework model with no `useSeeder`, say), which is still right for the
 * regular plurals that make up most of them.
 */
export function parentTable(parent: string): string {
  return modelTables.get(parent) ?? `${snakeCase(parent)}s`
}

/**
 * Fill the foreign keys a model's `belongsTo` implies.
 *
 * Without this a seeded database has rows but no edges: every field belongs to
 * no farm, every detection to no flight, and an app that joins them renders
 * nothing at all. The parent is picked at random from the rows that exist,
 * which is what makes the seeded graph look like a real one rather than a
 * hundred children hanging off row 1.
 *
 * Picking each parent independently is not enough once a model has more than
 * one. A flight that belongs to both a farm and a field would get a random
 * farm and a random field, and the field would usually belong to some other
 * farm - rows that satisfy every foreign key and describe something that
 * cannot happen. So each pick is constrained by the picks already made: the
 * parent whose own row carries the most foreign keys goes first, its keys are
 * adopted, and every later parent is drawn only from rows that agree with
 * them.
 */
async function relationColumns(model: SeederModel, options: SeederConfig = {}): Promise<Record<string, unknown>[]> {
  const parents = parentRelations(model)
  if (parents.length === 0)
    return []

  const pools: { column: string, rows: Record<string, unknown>[] }[] = []
  for (const relation of parents) {
    const parent = relation.model
    const column = relation.column

    /*
     * A declared key is no longer skipped outright.
     *
     * Relation keys have to be declared for anything else to see them: the
     * generated REST layer builds its writable and filterable columns from a
     * model's attributes, so an undeclared `farm_id` cannot be set by a POST
     * or filtered with `?farm_id=`. Declaring it used to cost the seeder the
     * relation entirely — the model owned the column, so nothing wired it, and
     * every seeded row landed unattached. The value a factory produces still
     * wins (see below); this only fills the key when it came out empty.
     */
    if (model.attributes[parent])
      continue

    // Never hand a seeded row to somebody's account (see ACCOUNT_MODELS).
    if (isAccountModel(parent) && !options.allowProtected)
      continue

    const rows = await existingRows(parentTable(parent))
    if (rows.length > 0)
      pools.push({ column, rows })
  }

  return chooseRelations(pools, model.count)
}

/**
 * Choose one consistent set of parent ids per record.
 *
 * Split out from the query above so the rule can be exercised without a
 * database: given the parent rows, the same input always produces rows whose
 * foreign keys agree with one another.
 */
export function chooseRelations(
  pools: { column: string, rows: Record<string, unknown>[] }[],
  count: number,
): Record<string, unknown>[] {
  if (pools.length === 0)
    return []

  // The columns this model is filling: only these are worth inheriting from a
  // parent row, and only these can constrain a later pick.
  const wanted = new Set(pools.map(pool => pool.column))

  /** How many of the other foreign keys this parent's rows carry. */
  const specificity = (pool: { column: string, rows: Record<string, unknown>[] }): number => {
    const sample = pool.rows[0] ?? {}
    return [...wanted].filter(column => column !== pool.column && column in sample).length
  }

  const ordered = [...pools].sort((a, b) => specificity(b) - specificity(a))

  return Array.from({ length: count }, () => {
    const row: Record<string, unknown> = {}

    for (const pool of ordered) {
      // An ancestor already inherited from an earlier, more specific parent.
      if (row[pool.column] != null)
        continue

      const agrees = (candidate: Record<string, unknown>): boolean =>
        [...wanted].every(column => row[column] == null || candidate[column] == null || candidate[column] === row[column])

      const candidates = pool.rows.filter(agrees)
      const from = candidates.length > 0 ? candidates : pool.rows
      const chosen = from[Math.floor(Math.random() * from.length)]!

      row[pool.column] = chosen.id

      // Adopt the parent's own keys, so a flight sits on the farm its field
      // belongs to rather than on a farm of its own.
      for (const column of wanted) {
        if (column !== pool.column && row[column] == null && chosen[column] != null)
          row[column] = chosen[column]
      }
    }

    return row
  })
}

async function generateRecords(model: SeederModel, options: SeederConfig = {}): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = []
  const relations = await relationColumns(model, options)

  for (let i = 0; i < model.count; i++) {
    // A factory that throws is reported on the first record and then stays
    // quiet, so one broken attribute does not print once per row. It is
    // reported whether or not `--verbose` was passed: the failure is silently
    // replaced with a default, and a column that comes out null across the
    // whole table is otherwise indistinguishable from one nobody declared.
    const record = await generateRecord(model.attributes, model.name, i === 0)
    const fixture = model.fixtures[i]
    // Relations fill only what the record left empty, so an explicit factory
    // on a declared key keeps its value.
    const relation = relations[i] ?? {}
    const withRelations = { ...record }
    for (const [column, value] of Object.entries(relation)) {
      if (withRelations[column] == null)
        withRelations[column] = value
    }
    records.push(fixture ? { ...withRelations, ...fixtureToColumns(fixture) } : withRelations)
  }

  return records
}

/**
 * Seed a single model
 */
async function seedModel(model: SeederModel, options: SeederConfig): Promise<SeedResult> {
  const startTime = Date.now()

  try {
    // Check if the table exists before attempting to seed
    try {
      await db.selectFrom(model.table).limit(0).execute()
    }
    catch (tableErr: any) {
      const msg = tableErr?.message || ''
      // Only skip for missing table errors, not for other connection issues
      if (msg.includes('does not exist') || msg.includes('no such table') || msg.includes('doesn\'t exist')) {
        log.info(`  Skipping ${model.name}: table "${model.table}" does not exist`)
        return {
          model: model.name,
          table: model.table,
          count: 0,
          success: true,
          duration: Date.now() - startTime,
        }
      }
      // Re-throw other errors (connection issues, etc.)
      throw tableErr
    }

    if (!options.fresh && !options.append) {
      const existing = await db.selectFrom(model.table)
        .selectAll()
        .limit(1)
        .executeTakeFirst()
      if (existing) {
        if (options.verbose) {
          log.info(`  ${model.name}: table already has rows - skipping (--append to add more, --fresh to replace)`)
        }
        return {
          model: model.name,
          table: model.table,
          count: 0,
          success: true,
          duration: Date.now() - startTime,
        }
      }
    }

    // Generate records
    const records = await generateRecords(model, options)

    if (records.length === 0) {
      return {
        model: model.name,
        table: model.table,
        count: 0,
        success: true,
        duration: Date.now() - startTime,
      }
    }

    // Insert records in batches for better performance
    const batchSize = 100
    let inserted = 0

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)

      await db.insertInto(model.table)
        .values(batch as any)
        .execute()

      inserted += batch.length
    }

    if (options.verbose) {
      log.success(`  Seeded ${model.name}: ${inserted} records`)
    }

    return {
      model: model.name,
      table: model.table,
      count: inserted,
      success: true,
      duration: Date.now() - startTime,
    }
  }
  catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)

    if (options.verbose) {
      log.error(`  Failed to seed ${model.name}: ${errorMessage}`)
    }

    return {
      model: model.name,
      table: model.table,
      count: 0,
      success: false,
      error: errorMessage,
      duration: Date.now() - startTime,
    }
  }
}

/** A parent a model belongs to, and the column that points at it. */
export interface ParentRelation {
  model: string
  column: string
}

/**
 * The parents a model declares, with the column each one is reached through.
 *
 * The column defaults to `<model>_id`, which is what most relations look like.
 * An entry may override it with `foreignKey`, and doing so is not a niceness:
 * a model that belongs to `User` twice — an author and a reviewer — has no
 * `user_id` at all, so under the derived name neither key was ever filled and
 * both fell back to whatever the factory invented.
 */
export function parentRelations(model: SeederModel): ParentRelation[] {
  const belongsTo = (model.model as { belongsTo?: unknown }).belongsTo

  const read = (entry: unknown): ParentRelation | null => {
    if (typeof entry === 'string')
      return entry ? { model: entry, column: `${snakeCase(entry)}_id` } : null

    if (entry && typeof entry === 'object') {
      const name = String((entry as { model?: string }).model ?? '')
      if (!name)
        return null

      const key = (entry as { foreignKey?: string }).foreignKey

      return { model: name, column: key || `${snakeCase(name)}_id` }
    }

    return null
  }

  const entries = Array.isArray(belongsTo)
    ? belongsTo
    : (belongsTo && typeof belongsTo === 'object' ? Object.values(belongsTo as Record<string, unknown>) : [])

  return entries.map(read).filter((relation): relation is ParentRelation => relation !== null)
}

/** The models a model declares it belongs to, however the relation is written. */
function parentModels(model: SeederModel): string[] {
  return parentRelations(model).map(relation => relation.model)
}

/**
 * Order the models so a parent is always seeded before its children.
 *
 * This used to be a hardcoded list of three names — User, Team, Project —
 * which meant any other graph seeded in directory order and children were
 * written before the rows they point at existed. The order now comes from the
 * models' own `belongsTo` declarations, which is where the app already says
 * what depends on what.
 *
 * A cycle (two models that belong to each other) cannot be ordered; those are
 * emitted last, in their original order, rather than dropped.
 */
/**
 * Empty every seedable table before a fresh seed.
 *
 * In reverse dependency order, and in one pass before any seeding starts.
 * Clearing each table just before its own insert ran parents-first, so
 * emptying `farms` while `fields` still pointed at them raised a foreign key
 * error — which was swallowed as "the table might not exist". The seed then
 * appended to a table it believed it had emptied, and every `--fresh` run
 * left more rows behind than the last.
 */
async function clearTables(models: SeederModel[], verbose?: boolean): Promise<void> {
  for (const model of [...models].reverse()) {
    try {
      await db.deleteFrom(model.table).execute()
      if (verbose)
        log.info(`  Truncated table: ${model.table}`)
    }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      // A table that has not been migrated yet is not a problem; anything
      // else is, and staying quiet about it is what hid this for so long.
      if (/no such table|doesn't exist|does not exist/i.test(message))
        continue

      throw new Error(`Could not empty ${model.table} before seeding: ${message}`)
    }
  }
}

function sortModelsByDependencies(models: SeederModel[]): SeederModel[] {
  const byName = new Map(models.map(model => [model.name, model]))
  const ordered: SeederModel[] = []
  const state = new Map<string, 'visiting' | 'done'>()

  const visit = (model: SeederModel): void => {
    const status = state.get(model.name)
    if (status === 'done' || status === 'visiting')
      return

    state.set(model.name, 'visiting')

    for (const parentName of parentModels(model)) {
      const parent = byName.get(parentName)
      if (parent && parent !== model)
        visit(parent)
    }

    state.set(model.name, 'done')
    ordered.push(model)
  }

  for (const model of models)
    visit(model)

  return ordered
}

/**
 * Seeds the database from your models.
 *
 * Walks every model that declares a `useSeeder` trait and fills its table
 * using the per-attribute `factory: faker => …` declarations. Models are
 * loaded from `app/Models/` and, with `includeDefaults`, the framework's
 * built-in models too - user models win on a name collision.
 *
 * This is what `./buddy seed` runs.
 */
export async function seed(config: SeederConfig = {}): Promise<SeedSummary> {
  const startTime = Date.now()
  await ensureDatabaseConfigLoaded()

  const modelsDir = config.modelsDir || path.userModelsPath()
  const verbose = config.verbose ?? true

  if (verbose) {
    log.info('Seeding database using model factories...')
    log.info(`User models directory: ${modelsDir}`)
    log.info(`Default models directory: ${defaultModelsPath()}`)
  }

  // Load all seedable models from both defaults and user directories
  let models = await loadAllModels(modelsDir, verbose, config.includeDefaults ?? false)

  // Registered before any filtering, so a parent excluded from this run is
  // still resolvable when a child needs its table to fill a foreign key.
  registerModelTables(models)

  if (models.length === 0) {
    log.warn('No seedable models found in defaults or user directories')
    return {
      total: 0,
      successful: 0,
      failed: 0,
      results: [],
      duration: Date.now() - startTime,
    }
  }

  // Filter models if only/except is specified
  if (config.only && config.only.length > 0) {
    models = models.filter(m => config.only!.includes(m.name))
  }

  if (config.except && config.except.length > 0) {
    models = models.filter(m => !config.except!.includes(m.name))
  }

  // Protected-model guard (stacksjs/stacks#1852).
  //
  // Auth/oauth models are unsafe to auto-seed on a non-fresh database
  // because their rows feed token validation. Skip them unless the
  // caller opted in via `fresh` (tables are truncated first — live
  // tokens are gone anyway) or `allowProtected` (explicit escape
  // hatch surfaced as `./buddy seed --allow-protected`).
  //
  // The skip is logged unconditionally — silence here is what caused the
  // original "Unauthorized. Invalid token." mystery in the first place.
  if (!config.fresh && !config.allowProtected) {
    const skipped: SeederModel[] = []
    models = models.filter((m) => {
      if (isProtectedModel(m.name)) {
        skipped.push(m)
        return false
      }
      return true
    })
    if (skipped.length > 0) {
      log.info(
        `Skipped ${skipped.length} protected auth model(s) to avoid invalidating live sessions: ${skipped.map(m => m.name).join(', ')}`,
      )
      log.info('  Re-run with --fresh (truncates tables first) or --allow-protected to include them.')
    }
  }

  // Sort by dependencies
  models = sortModelsByDependencies(models)

  if (verbose) {
    log.info(`Found ${models.length} seedable model(s)`)
  }

  if (config.fresh)
    await clearTables(models, verbose)

  // Seed each model
  const results: SeedResult[] = []

  for (const model of models) {
    if (verbose) {
      log.info(`Seeding ${model.name} (${model.count} records)...`)
    }

    try {
      const result = await seedModel(model, config)
      results.push(result)
    }
    catch (err) {
      // Catch any uncaught errors to ensure we continue to next model
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (verbose) {
        log.error(`  Unexpected error seeding ${model.name}: ${errorMessage}`)
      }
      results.push({
        model: model.name,
        table: model.table,
        count: 0,
        success: false,
        error: errorMessage,
        duration: 0,
      })
    }
  }

  // Calculate summary
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const totalRecords = results.reduce((sum, r) => sum + r.count, 0)

  if (verbose) {
    log.info('')
    if (failed === 0) {
      log.success(`Database seeded successfully!`)
      log.info(`  Total records: ${totalRecords}`)
      log.info(`  Models seeded: ${successful}`)
    }
    else {
      log.warn(`Seeding completed with ${failed} failure(s)`)
      log.info(`  Successful: ${successful}`)
      log.info(`  Failed: ${failed}`)
    }
  }

  return {
    total: results.length,
    successful,
    failed,
    results,
    duration: Date.now() - startTime,
  }
}

/**
 * Seed a specific model by name
 * Searches both default and user models
 */
export async function seedModel$(
  modelName: string,
  options: { count?: number, fresh?: boolean, verbose?: boolean } = {},
): Promise<SeedResult> {
  const modelsDir = path.userModelsPath()
  const models = await loadAllModels(modelsDir, options.verbose)
  const model = models.find(m => m.name === modelName)

  if (!model) {
    throw new Error(`Model not found: ${modelName}`)
  }

  // Override count if specified
  if (options.count) {
    model.count = options.count
  }

  return seedModel(model, {
    fresh: options.fresh,
    verbose: options.verbose ?? true,
  })
}

/**
 * Fresh seed - truncate all tables and reseed
 */
export async function freshSeed(config: SeederConfig = {}): Promise<SeedSummary> {
  return seed({ ...config, fresh: true })
}

/**
 * Get list of seedable models without seeding
 * Returns models from both default and user directories
 */
export async function listSeedableModels(): Promise<Array<{ name: string, table: string, count: number, source: 'default' | 'user' }>> {
  const modelsDir = path.userModelsPath()
  const defaultDir = defaultModelsPath()

  // Load both sets separately to track source
  const defaultModels = await loadModelsFromDir(defaultDir, true)
  const userModels = await loadModelsFromDir(modelsDir, false)

  const result: Array<{ name: string, table: string, count: number, source: 'default' | 'user' }> = []
  const seen = new Set<string>()

  // Add user models first (they take precedence)
  for (const m of userModels) {
    result.push({
      name: m.name,
      table: m.table,
      count: m.count,
      source: 'user',
    })
    seen.add(m.name)
  }

  // Add default models that weren't overridden
  for (const m of defaultModels) {
    if (!seen.has(m.name)) {
      result.push({
        name: m.name,
        table: m.table,
        count: m.count,
        source: 'default',
      })
    }
  }

  return result
}

// Legacy exports for backwards compatibility
export { seed as runSeeders }
export { freshSeed as freshWithSeed }
