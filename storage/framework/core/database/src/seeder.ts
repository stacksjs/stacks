/**
 * Database Seeder Module
 *
 * Provides model-based seeding using factory functions defined on model attributes.
 * This module reads models from app/Models/ and generates fake data using the
 * factory functions and faker instance from @stacksjs/faker.
 */

import type { Attribute, Model, SeedOptions } from '@stacksjs/types'
import { log } from '@stacksjs/cli'
import { db } from '@stacksjs/database'
import { faker } from '@stacksjs/faker'
import { path } from '@stacksjs/path'
import { hashMake } from '@stacksjs/security'
import { fs } from '@stacksjs/storage'

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
 * Load all models from the models directory
 */
async function loadModels(modelsDir: string): Promise<SeederModel[]> {
  const models: SeederModel[] = []

  if (!fs.existsSync(modelsDir)) {
    log.warn(`Models directory not found: ${modelsDir}`)
    return models
  }

  const files = fs.readdirSync(modelsDir)
  const modelFiles = files.filter(file =>
    file.endsWith('.ts') && !file.startsWith('index') && !file.startsWith('_'),
  )

  for (const file of modelFiles) {
    const filePath = path.join(modelsDir, file)

    try {
      const module = await import(filePath)
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
      const modelName = modelDef.name || file.replace('.ts', '')
      const tableName = modelDef.table || snakeCase(modelName) + 's'

      models.push({
        name: modelName,
        table: tableName,
        count,
        attributes: modelDef.attributes || {},
        model: modelDef,
        filePath,
      })
    }
    catch (err) {
      log.error(`Failed to load model ${file}:`, err)
    }
  }

  return models
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

    // Hash password fields
    if (isPasswordField(fieldName, attr) && typeof value === 'string') {
      try {
        value = await hashMake(value)
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
 */
export async function seed(config: SeederConfig = {}): Promise<SeedSummary> {
  const startTime = Date.now()
  const modelsDir = config.modelsDir || path.userModelsPath()
  const verbose = config.verbose ?? true

  if (verbose) {
    log.info('Seeding database using model factories...')
    log.info(`Models directory: ${modelsDir}`)
  }

  // Load all seedable models
  let models = await loadModels(modelsDir)

  if (models.length === 0) {
    log.warn('No seedable models found')
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
 */
export async function seedModel$(
  modelName: string,
  options: { count?: number, fresh?: boolean, verbose?: boolean } = {},
): Promise<SeedResult> {
  const modelsDir = path.userModelsPath()
  const models = await loadModels(modelsDir)
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
 */
export async function listSeedableModels(): Promise<Array<{ name: string, table: string, count: number }>> {
  const modelsDir = path.userModelsPath()
  const models = await loadModels(modelsDir)

  return models.map(m => ({
    name: m.name,
    table: m.table,
    count: m.count,
  }))
}

// Legacy exports for backwards compatibility
export { seed as runSeeders }
export { freshSeed as freshWithSeed }
