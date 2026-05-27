/**
 * Codemod: generate `database/seeders/<Model>Seeder.ts` for every model
 * with a `useSeeder` trait that doesn't already have a class seeder
 * file. Output mirrors the canonical shape from stacksjs/stacks#1919:
 *
 *   import { factory, Seeder } from '@stacksjs/database'
 *   import Judge from '../../app/Models/Judge'
 *
 *   export default class JudgeSeeder extends Seeder {
 *     async run() {
 *       await factory.generate(Judge, { count: 10 })
 *     }
 *   }
 *
 * The auto-walker is on a deprecation timer — this codemod is the
 * migration path so adopters can flip their model trait into a
 * checked-in seeder file before the walker is removed. Lives in the
 * database package so it can be imported from buddy without dragging
 * the rest of the actions package along.
 */

import type { Model, SeedOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from '@stacksjs/storage'

export interface ScaffoldOptions {
  /** Override the source models directory. Defaults to `app/Models/`. */
  modelsDir?: string
  /** Override the output seeders directory. Defaults to `database/seeders/`. */
  seedersDir?: string
  /** Overwrite existing seeder files. Default false (skips with a log line). */
  force?: boolean
  /** Plan-only mode — print what would be generated, write nothing. */
  dryRun?: boolean
}

export interface ScaffoldResult {
  generated: Array<{ model: string, file: string }>
  skipped: Array<{ model: string, file: string, reason: 'already-exists' | 'no-useseeder' }>
  errors: Array<{ model: string, error: string }>
}

const SEEDER_TEMPLATE = (modelName: string, modelImportPath: string, count: number): string => `import { factory, Seeder } from '@stacksjs/database'
import ${modelName} from '${modelImportPath}'

export default class ${modelName}Seeder extends Seeder {
  async run(): Promise<void> {
    await factory.generate(${modelName}, { count: ${count} })
  }
}
`

function relativeModelImport(seedersDir: string, modelFilePath: string): string {
  const rel = path.relative(seedersDir, modelFilePath).replace(/\\/g, '/')
  const noExt = rel.replace(/\.ts$/, '')
  return noExt.startsWith('.') ? noExt : `./${noExt}`
}

/**
 * Walk the configured models directory, find every model whose
 * `traits.useSeeder` is truthy, and write a class-seeder file for it.
 * Returns a structured report so the CLI command can render a summary
 * without re-parsing log lines.
 */
export async function scaffoldClassSeedersFromModels(
  options: ScaffoldOptions = {},
): Promise<ScaffoldResult> {
  const modelsDir = options.modelsDir ?? path.userModelsPath()
  const seedersDir = options.seedersDir ?? path.projectPath('database/seeders')

  const result: ScaffoldResult = { generated: [], skipped: [], errors: [] }

  if (!fs.existsSync(modelsDir)) {
    log.warn(`[seed:scaffold] No models directory at ${modelsDir}`)
    return result
  }

  if (!options.dryRun && !fs.existsSync(seedersDir)) {
    fs.mkdirSync(seedersDir, { recursive: true })
  }

  const entries = fs.readdirSync(modelsDir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue
    if (entry.name.startsWith('_') || entry.name.startsWith('index')) continue

    const modelFilePath = path.join(modelsDir, entry.name)
    let modelDef: Model | undefined
    try {
      const module = await import(modelFilePath)
      modelDef = (module.default || module) as Model
    }
    catch (err) {
      result.errors.push({ model: entry.name, error: (err as Error).message })
      continue
    }

    if (!modelDef || !modelDef.name) {
      result.errors.push({ model: entry.name, error: 'missing default export with `name` field' })
      continue
    }

    const useSeeder = modelDef.traits?.useSeeder ?? modelDef.traits?.seedable
    if (!useSeeder) {
      result.skipped.push({ model: modelDef.name, file: '', reason: 'no-useseeder' })
      continue
    }

    const count = (typeof useSeeder === 'object' && 'count' in (useSeeder as SeedOptions))
      ? (useSeeder as SeedOptions).count
      : 10

    const seederFileName = `${modelDef.name}Seeder.ts`
    const seederFilePath = path.join(seedersDir, seederFileName)

    if (fs.existsSync(seederFilePath) && !options.force) {
      result.skipped.push({ model: modelDef.name, file: seederFilePath, reason: 'already-exists' })
      continue
    }

    const importPath = relativeModelImport(seedersDir, modelFilePath)
    const content = SEEDER_TEMPLATE(modelDef.name, importPath, count)

    if (options.dryRun) {
      log.info(`[seed:scaffold] would write ${seederFilePath}`)
    }
    else {
      fs.writeFileSync(seederFilePath, content, 'utf-8')
    }
    result.generated.push({ model: modelDef.name, file: seederFilePath })
  }

  return result
}

/** Pure renderer — exported for unit tests. */
export function renderSeederFile(modelName: string, modelImportPath: string, count: number): string {
  return SEEDER_TEMPLATE(modelName, modelImportPath, count)
}
