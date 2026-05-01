import type { CLI } from '@stacksjs/types'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { italic, log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

/**
 * A single config codemod — describes a search-and-replace operation
 * against a user config file under `~/config/<file>.ts`. Each codemod
 * is targeted at one specific Stacks-version transition (e.g. "0.65 →
 * 0.66 renamed `cache.driver` to `cache.default`"). The replacement is
 * a string transform — we deliberately avoid AST manipulation here
 * because the input is user TS, comments matter, and we'd rather
 * produce a textual diff than gamble on `ts-morph` reformatting code.
 */
export interface ConfigCodemod {
  id: string
  description: string
  /** Files relative to `config/`. Wildcard is intentionally not supported. */
  files: string[]
  /** Test whether this file needs the codemod. Cheap — just a substring scan. */
  shouldApply(content: string): boolean
  /** Apply the transform. Return the new file contents. */
  apply(content: string): string
}

const CODEMODS: ConfigCodemod[] = [
  {
    id: '0.65-cache-driver-rename',
    description: 'Rename `cache.driver` to `cache.default` (introduced in 0.65).',
    files: ['cache.ts'],
    shouldApply: (c) => /\bdriver\s*:/.test(c) && !c.includes('default:'),
    apply: c => c.replace(/(\bcache\b[\s\S]*?)\bdriver(\s*:)/m, '$1default$2'),
  },
  {
    id: '0.68-search-engine-name',
    description: 'Rename `searchEngine.driver` to `searchEngine.default` (matches other configs).',
    files: ['search-engine.ts'],
    shouldApply: (c) => /\bdriver\s*:/.test(c),
    apply: c => c.replace(/\bdriver(\s*:)/g, 'default$1'),
  },
  {
    id: '0.70-ports-string-to-number',
    description: 'Convert string port values like `"3000"` to numbers (TypeScript types now require number).',
    files: ['ports.ts'],
    shouldApply: c => /:\s*['"]\d+['"]/.test(c),
    apply: c => c.replace(/:\s*['"](\d+)['"]/g, ': $1'),
  },
]

/**
 * Run all applicable codemods against the user's `config/*.ts` files.
 * Honors `--dry-run` (prints diffs without writing) and `--only=<id>`
 * (restrict to a single codemod).
 */
export async function runConfigMigrations(opts: {
  dryRun?: boolean
  only?: string
}): Promise<{ changed: string[], skipped: string[] }> {
  const changed: string[] = []
  const skipped: string[] = []

  const codemods = opts.only
    ? CODEMODS.filter(m => m.id === opts.only)
    : CODEMODS

  if (codemods.length === 0) {
    log.warn(`No matching codemods. Available: ${CODEMODS.map(m => m.id).join(', ')}`)
    return { changed, skipped }
  }

  for (const cm of codemods) {
    log.info(`Codemod ${italic(cm.id)} — ${cm.description}`)
    for (const rel of cm.files) {
      const full = projectPath(`config/${rel}`)
      if (!existsSync(full)) {
        skipped.push(`${full} (missing)`)
        continue
      }
      const before = readFileSync(full, 'utf-8')
      if (!cm.shouldApply(before)) {
        skipped.push(`${full} (no changes)`)
        continue
      }
      const after = cm.apply(before)
      if (after === before) {
        skipped.push(`${full} (no changes)`)
        continue
      }
      if (opts.dryRun) {
        log.info(`[dry-run] would update ${full}`)
        printDiff(before, after)
      }
      else {
        writeFileSync(full, after)
        log.success(`updated ${full}`)
      }
      changed.push(full)
    }
  }

  return { changed, skipped }
}

function printDiff(before: string, after: string): void {
  // Plain line-by-line diff. Stacks doesn't ship a diff dependency and a
  // proper Myers diff is overkill here — these codemods are usually
  // one or two lines wide.
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')
  const max = Math.max(beforeLines.length, afterLines.length)
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i]
    const a = afterLines[i]
    if (b === a) continue
    if (b !== undefined) process.stdout.write(`  - ${b}\n`)
    if (a !== undefined) process.stdout.write(`  + ${a}\n`)
  }
  process.stdout.write('\n')
}

export function configMigrate(buddy: CLI): void {
  buddy
    .command('config:migrate', 'Apply config-shape codemods for the latest Stacks version')
    .option('--dry-run', 'Preview changes without writing', { default: false })
    .option('--only [id]', 'Run a single codemod by id', { default: '' })
    .action(async (options: { dryRun?: boolean, only?: string }) => {
      log.info('Running `buddy config:migrate` ...')
      const { changed, skipped } = await runConfigMigrations({
        dryRun: Boolean(options.dryRun),
        only: options.only?.length ? options.only : undefined,
      })
      log.info(`Changed: ${changed.length}, Skipped: ${skipped.length}`)
      if (skipped.length > 0) {
        for (const s of skipped) log.debug(`  skipped: ${s}`)
      }
    })
}
