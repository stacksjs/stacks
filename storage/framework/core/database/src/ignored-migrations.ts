import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { basename } from 'node:path'
import { path } from '@stacksjs/path'
import { isGeneratedMigration } from './generated-migration-marker'

/**
 * Migrations git will never commit.
 *
 * A machine-wide `*.sql` ignore — common, because it keeps database dumps out
 * of every repository — also matches `database/migrations/*.sql`. The file
 * exists, `buddy migrate` runs it locally and every test passes, and
 * `git add -A` silently leaves it behind. CI and the deploy then build a
 * database without it, and the first sign is a model whose table does not
 * exist: on one app, every request that touched it answered 500 while the
 * deploy reported success.
 *
 * Nothing about that is visible from inside the project — the ignore rule
 * lives in the developer's global git config — so this asks git directly.
 * Outside a git checkout, or without git installed, it answers "none": the
 * check must never be the thing that breaks a migrate.
 */
export function findIgnoredMigrations(migrationsDir: string = path.userMigrationsPath()): string[] {
  let files: string[]
  try {
    files = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.sql'))
  }
  catch {
    return []
  }
  if (!files.length)
    return []

  try {
    const result = spawnSync('git', ['check-ignore', '--stdin', '-z'], {
      cwd: migrationsDir,
      input: `${files.join('\0')}\0`,
      encoding: 'utf8',
      timeout: 5000,
    })
    // 0: some are ignored. 1: none are. 128: not a git checkout, or git
    // failed — either way, not something to report.
    if (result.status !== 0 || typeof result.stdout !== 'string')
      return []
    return result.stdout.split('\0').filter(Boolean).map(file => basename(file)).sort()
  }
  catch {
    return []
  }
}

/**
 * Keep generator-owned schema history visible even under a global SQL ignore.
 * Intent-to-add registers the paths without staging their contents: ordinary
 * git diff / git add still let the developer review SQL with its model change.
 * Existing staged files, unmarked SQL, and repositories' ignore rules stay as
 * they are. Outside a checkout, findIgnoredMigrations returns no candidates.
 */
export function trackIgnoredGeneratedMigrations(migrationsDir: string = path.userMigrationsPath()): string[] {
  const files = findIgnoredMigrations(migrationsDir).filter(file => isGeneratedMigration(migrationsDir, file))
  if (!files.length)
    return []
  const result = spawnSync('git', ['add', '--intent-to-add', '--force', '--', ...files], {
    cwd: migrationsDir,
    encoding: 'utf8',
    timeout: 5000,
  })
  if (result.status !== 0) {
    const reason = result.error?.message || result.stderr.trim() || 'git add failed'
    throw new Error(`Could not make generated migrations visible to Git: ${reason}. Resolve the Git error and rerun buddy generate:migrations.`)
  }
  return files
}

/** Where the ignore comes from, when git can say: `~/.gitignore_global:26:*.sql`. */
export function describeIgnoreRule(migrationsDir: string, file: string): string | null {
  try {
    const result = spawnSync('git', ['check-ignore', '-v', file], { cwd: migrationsDir, encoding: 'utf8', timeout: 5000 })
    const line = result.status === 0 ? result.stdout.trim() : ''
    const rule = line.split('\t')[0]
    return rule || null
  }
  catch {
    return null
  }
}

/** The warning `buddy migrate` and `buddy make:migration` print. */
export function formatIgnoredMigrations(files: string[], migrationsDir: string = path.userMigrationsPath()): string {
  const shown = files.slice(0, 5).map(file => `  - database/migrations/${file}`)
  if (files.length > 5)
    shown.push(`  - …and ${files.length - 5} more`)
  const rule = files[0] ? describeIgnoreRule(migrationsDir, files[0]) : null
  return [
    `${files.length === 1 ? 'A migration is' : `${files.length} migrations are`} ignored by git and will never be committed:`,
    ...shown,
    rule ? `The rule matching them: ${rule}` : 'A gitignore rule (often a global `*.sql`) matches them.',
    'They run here, but CI and the deploy will build a database without them.',
    'Run `buddy generate:migrations` to register ignored generated migrations for normal Git staging.',
    'For an existing unmarked migration, use `git add --force -- <migration-path>` after reviewing it.',
  ].join('\n')
}
