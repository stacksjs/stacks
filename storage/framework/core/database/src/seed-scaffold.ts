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
  /** Models whose `useSeeder`/`seedable` trait was removed from the model file (stacksjs/stacks#1929). */
  strippedTrait: Array<{ model: string, file: string }>
  /** Models where the trait couldn't be safely auto-removed (unusual value shape) — strip manually. */
  traitStripSkipped: Array<{ model: string, file: string }>
}

/**
 * Remove a single `useSeeder` / `seedable` object-property from model
 * source text (stacksjs/stacks#1929). Brace-aware (balances nested
 * `{}` and skips string literals) and conservative: only strips the
 * documented value shapes (`true`, `false`, or a `{ … }` object). For
 * anything else (an identifier, a function call, a spread) it returns
 * `changed: false` so the caller can flag it for manual cleanup
 * instead of risking a mangled file.
 *
 * Exported for unit tests.
 */
export function stripUseSeederTrait(source: string): { source: string, changed: boolean, skipped: boolean } {
  let out = source
  let changed = false
  let skipped = false

  for (const name of ['useSeeder', 'seedable'] as const) {
    const re = new RegExp(`\\b${name}\\s*:`)
    const m = re.exec(out)
    if (!m)
      continue

    const keyStart = m.index
    let i = keyStart + m[0].length
    while (i < out.length && /\s/.test(out[i])) i++

    const valueChar = out[i]
    if (valueChar === '{') {
      // Balance braces, respecting string literals.
      let depth = 0
      let inStr: string | null = null
      for (; i < out.length; i++) {
        const ch = out[i]
        if (inStr) {
          if (ch === '\\') { i++; continue }
          if (ch === inStr) inStr = null
          continue
        }
        if (ch === '"' || ch === '\'' || ch === '`') { inStr = ch; continue }
        if (ch === '{') { depth++ }
        else if (ch === '}') { depth--; if (depth === 0) { i++; break } }
      }
    }
    else if (out.startsWith('true', i) || out.startsWith('false', i)) {
      i += out.startsWith('true', i) ? 4 : 5
    }
    else {
      // Unusual value (identifier / call / spread) — don't risk it.
      skipped = true
      continue
    }

    // Consume a trailing comma + an optional same-line `// comment`.
    let end = i
    while (end < out.length && (out[end] === ' ' || out[end] === '\t')) end++
    if (out[end] === ',') end++
    while (end < out.length && (out[end] === ' ' || out[end] === '\t')) end++
    if (out[end] === '/' && out[end + 1] === '/') {
      while (end < out.length && out[end] !== '\n') end++
    }

    // Drop the key's leading indentation, and the whole line if it
    // stood alone (leading newline + trailing newline both present).
    let start = keyStart
    while (start > 0 && (out[start - 1] === ' ' || out[start - 1] === '\t')) start--
    if (start > 0 && out[start - 1] === '\n' && out[end] === '\n')
      end++

    out = out.slice(0, start) + out.slice(end)
    changed = true
  }

  return { source: out, changed, skipped: skipped && !changed }
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

  const result: ScaffoldResult = { generated: [], skipped: [], errors: [], strippedTrait: [], traitStripSkipped: [] }

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

    const seederAlreadyExists = fs.existsSync(seederFilePath)
    if (seederAlreadyExists && !options.force) {
      result.skipped.push({ model: modelDef.name, file: seederFilePath, reason: 'already-exists' })
    }
    else {
      const importPath = relativeModelImport(seedersDir, modelFilePath)
      const content = SEEDER_TEMPLATE(modelDef.name, importPath, count)

      if (options.dryRun)
        log.info(`[seed:scaffold] would write ${seederFilePath}`)
      else
        fs.writeFileSync(seederFilePath, content, 'utf-8')

      result.generated.push({ model: modelDef.name, file: seederFilePath })
    }

    // stacksjs/stacks#1929 — once a class seeder exists (just written
    // here, or already on disk), the `useSeeder` trait is redundant and
    // misleading. Strip it from the model file in the same pass so the
    // migration actually lands instead of leaving a half-migrated state.
    try {
      const modelSource = fs.readFileSync(modelFilePath, 'utf-8')
      const { source: stripped, changed, skipped } = stripUseSeederTrait(modelSource)
      if (changed) {
        if (options.dryRun)
          log.info(`[seed:scaffold] would strip useSeeder trait from ${modelFilePath}`)
        else
          fs.writeFileSync(modelFilePath, stripped, 'utf-8')
        result.strippedTrait.push({ model: modelDef.name, file: modelFilePath })
      }
      else if (skipped) {
        result.traitStripSkipped.push({ model: modelDef.name, file: modelFilePath })
      }
    }
    catch (err) {
      result.errors.push({ model: modelDef.name, error: `trait strip failed: ${(err as Error).message}` })
    }
  }

  return result
}

/** Pure renderer — exported for unit tests. */
export function renderSeederFile(modelName: string, modelImportPath: string, count: number): string {
  return SEEDER_TEMPLATE(modelName, modelImportPath, count)
}
