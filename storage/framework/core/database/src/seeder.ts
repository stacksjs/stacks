/**
 * Database Seeder Module
 *
 * Provides model-based seeding using factory functions defined on model attributes.
 * This module reads models from both the framework defaults (storage/framework/defaults/models)
 * and user-defined models (app/Models/), with user models taking precedence.
 * Generates fake data using the factory functions and faker instance from @stacksjs/faker.
 */

import type { Attribute, Model, SeedOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { db } from '@stacksjs/database'
import { faker } from '@stacksjs/faker'
import { path } from '@stacksjs/path'
import { hashMake } from '@stacksjs/security'
import { fs } from '@stacksjs/storage'

/**
 * Returns the path to the framework default models directory
 */
function defaultModelsPath(subpath?: string): string {
  return path.frameworkPath(`defaults/models/${subpath || ''}`)
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
    // Handle numbers followed by letters
    .replace(/(\d)([A-Za-z])/g, '$1_$2')
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
interface SeederModel {
  name: string
  table: string
  count: number
  attributes: Record<string, Attribute>
  model: Model
  filePath: string
}

/**
 * Load all models from a directory (including subdirectories)
 */
async function loadModelsFromDir(modelsDir: string, recursive: boolean = false): Promise<SeederModel[]> {
  const models: SeederModel[] = []

  if (!fs.existsSync(modelsDir)) {
    return models
  }

  const entries = fs.readdirSync(modelsDir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(modelsDir, entry.name)

    // Handle subdirectories recursively if enabled
    if (entry.isDirectory() && recursive) {
      const subModels = await loadModelsFromDir(fullPath, true)
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
      if (!useSeeder) {
        continue
      }

      // Get seed count
      let count = 10 // default
      if (typeof useSeeder === 'object' && 'count' in useSeeder) {
        count = (useSeeder as SeedOptions).count
      }

      // Get model name and table name
      const modelName = modelDef.name || entry.name.replace('.ts', '')
      const tableName = modelDef.table || snakeCase(modelName) + 's'

      models.push({
        name: modelName,
        table: tableName,
        count,
        attributes: modelDef.attributes || {},
        model: modelDef,
        filePath: fullPath,
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
async function loadAllModels(userModelsDir: string, verbose: boolean = false): Promise<SeederModel[]> {
  const defaultDir = defaultModelsPath()

  // Load default models first (with recursive subdirectory support)
  const defaultModels = await loadModelsFromDir(defaultDir, true)

  // Load user models (flat directory)
  const userModels = await loadModelsFromDir(userModelsDir, false)

  // Create a map with default models, then override with user models
  const modelMap = new Map<string, SeederModel>()

  for (const model of defaultModels) {
    modelMap.set(model.name, model)
  }

  // User models override defaults
  for (const model of userModels) {
    if (modelMap.has(model.name) && verbose) {
      log.info(`  User model "${model.name}" overrides default`)
    }
    modelMap.set(model.name, model)
  }

  return Array.from(modelMap.values())
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
  verbose: boolean = false,
): Promise<Record<string, unknown>> {
  const record: Record<string, unknown> = {}

  for (const [fieldName, attr] of Object.entries(attributes)) {
    // Convert field name to snake_case for database column
    const columnName = snakeCase(fieldName)
    let value: unknown

    // Use factory function if defined
    if (attr.factory && typeof attr.factory === 'function') {
      try {
        value = attr.factory(faker)
      }
      catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        if (verbose) {
          log.warn(`  Factory failed for ${modelName}.${fieldName}: ${errorMsg}`)
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
        if (verbose) {
          log.warn(`  Failed to hash password for ${modelName}.${fieldName}: ${errorMsg}`)
        }
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
async function generateRecords(model: SeederModel, verbose: boolean = false): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = []

  for (let i = 0; i < model.count; i++) {
    // Only log factory failures for the first record to avoid spam
    const record = await generateRecord(model.attributes, model.name, verbose && i === 0)
    records.push(record)
  }

  return records
}

/**
 * Seed a single model
 */
async function seedModel(model: SeederModel, options: SeederConfig): Promise<SeedResult> {
  const startTime = Date.now()

  try {
    // Generate records
    const records = await generateRecords(model, options.verbose)

    if (records.length === 0) {
      return {
        model: model.name,
        table: model.table,
        count: 0,
        success: true,
        duration: Date.now() - startTime,
      }
    }

    // Truncate table if fresh option is enabled
    if (options.fresh) {
      try {
        await db.deleteFrom(model.table as any).execute()
        if (options.verbose) {
          log.info(`  Truncated table: ${model.table}`)
        }
      }
      catch {
        // Table might not exist yet, ignore
      }
    }

    // Insert records in batches for better performance
    const batchSize = 100
    let inserted = 0

    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)

      await db.insertInto(model.table as any)
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

/**
 * Sort models by dependencies (basic implementation)
 * Models with foreign keys should be seeded after their dependencies
 */
function sortModelsByDependencies(models: SeederModel[]): SeederModel[] {
  // For now, use a simple heuristic:
  // - User model first (many things depend on it)
  // - Models without relationships next
  // - Models with relationships last

  const priority: Record<string, number> = {
    User: 0,
    Team: 1,
    Project: 2,
  }

  return models.sort((a, b) => {
    const priorityA = priority[a.name] ?? 10
    const priorityB = priority[b.name] ?? 10
    return priorityA - priorityB
  })
}

/**
 * Main seeding function
 * Seeds the database using model factory functions
 * Loads models from both framework defaults and user-defined models,
 * with user models taking precedence.
 */
export async function seed(config: SeederConfig = {}): Promise<SeedSummary> {
  const startTime = Date.now()
  const modelsDir = config.modelsDir || path.userModelsPath()
  const verbose = config.verbose ?? true

  if (verbose) {
    log.info('Seeding database using model factories...')
    log.info(`User models directory: ${modelsDir}`)
    log.info(`Default models directory: ${defaultModelsPath()}`)
  }

  // Load all seedable models from both defaults and user directories
  let models = await loadAllModels(modelsDir, verbose)

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

  // Sort by dependencies
  models = sortModelsByDependencies(models)

  if (verbose) {
    log.info(`Found ${models.length} seedable model(s)`)
  }

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
