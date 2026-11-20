import type { GenerationTask } from '@stacksjs/actions/daemon/generation-config'
import { spawnSync } from 'node:child_process'
import { lstatSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { generationTasks, readGenerationConfig } from '@stacksjs/actions/daemon/generation-config'
import { resultError, resultFailed } from './result'

const importFiles = [
  'RUNTIME.md', 'actions.ts', 'controllers.ts', 'emails.ts', 'functions.ts', 'globals.ts',
  'index.ts', 'jobs.ts', 'listeners.ts', 'middleware.ts', 'models.ts', 'policies.ts', 'sources.json',
].map(file => `storage/framework/auto-imports/${file}`).concat([
  'storage/framework/types/browser-auto-imports.d.ts',
  'storage/framework/types/server-auto-imports.d.ts',
  'storage/framework/browser-auto-imports.json',
  'storage/framework/server-auto-imports.json',
])

const typeFiles = ['storage/framework/auto-imports/routes.ts', 'database/types.d.ts']
const migrationDirectories = ['database/migrations', 'storage/framework/database']

function git(root: string, ...args: string[]): string {
  const result = spawnSync('git', ['--literal-pathspecs', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15_000,
  })
  if (result.status !== 0)
    throw new Error(result.error?.message ?? (result.stderr.trim() || `git ${args[0]} failed`))
  return result.stdout
}

function generatedChanges(root: string, files: string[]): Map<string, string> {
  const status = git(root, 'status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all', '--', ...files)
  return new Map(status.split('\0').filter(Boolean).map(entry => [entry.slice(3), entry.slice(0, 2)]))
}

function gitRevision(root: string): string {
  return git(root, 'rev-parse', 'HEAD', '--symbolic-full-name', 'HEAD')
}

/** Commit only clean-before paths whose contents the requested generators own. */
async function prepareCommit(root: string, tasks: GenerationTask[]): Promise<(() => Promise<void>) | undefined> {
  let revision: string
  try {
    if (git(root, 'rev-parse', '--show-prefix').trim())
      return
    revision = gitRevision(root)
  }
  catch {
    // A new project can generate before it has a repository or first commit.
    return
  }

  const files = [
    ...(tasks.includes('imports') ? importFiles : []),
    ...(tasks.includes('types') ? typeFiles : []),
  ]
  const migrations = tasks.includes('migrations')
  const scope = [...files, ...(migrations ? migrationDirectories : [])]
  const before = generatedChanges(root, scope)
  return async () => {
    if (gitRevision(root) !== revision)
      return

    const changed: string[] = []
    const newFiles: string[] = []
    const { isGeneratedMigration } = migrations ? await import('@stacksjs/database') : { isGeneratedMigration: undefined }
    for (const [file, status] of generatedChanges(root, scope)) {
      if (before.has(file) || (status !== ' M' && status !== '??'))
        continue
      const fullPath = join(root, file)
      if (!lstatSync(fullPath).isFile())
        continue
      const snapshot = /^storage\/framework\/database\/model-snapshot\.(?:sqlite|mysql|postgres|singlestore|vitess)\.json$/.test(file)
      const generatedSql = /^database\/migrations\/(?:[^/]+\/)?\d{10}-.+\.sql$/.test(file)
        && isGeneratedMigration?.(dirname(fullPath), basename(fullPath))
      if (!files.includes(file) && !snapshot && !generatedSql)
        continue
      changed.push(file)
      if (status === '??')
        newFiles.push(file)
    }

    if (changed.length === 0)
      return
    if (newFiles.length > 0)
      git(root, 'add', '--intent-to-add', '--', ...newFiles)
    git(root, 'commit', '--only', '-m', 'chore: regenerate Stacks artifacts', '--', ...changed)
  }
}

/** Run once inside the project, under its installed framework and Bun config. */
export async function generateProject(root: string, selection: string): Promise<void> {
  const config = readGenerationConfig(root)
  if (!config)
    return
  const requested = new Set(selection.split(','))
  const tasks = generationTasks.filter(task => requested.has(task) && config.tasks.includes(task))
  if (tasks.length === 0)
    return

  const commit = config.autoCommit ? await prepareCommit(root, tasks) : undefined
  const failures: string[] = []
  for (const task of tasks) {
    try {
      if (task === 'imports') {
        const { generateAutoImportFiles } = await import('@stacksjs/server')
        await generateAutoImportFiles()
      }
      else if (task === 'migrations') {
        const { generateMigrations, siblingMigrationDialects } = await import('@stacksjs/database')
        for (const dialect of [undefined, ...await siblingMigrationDialects()]) {
          const result = await generateMigrations({ dialect, fromDb: false, allowDestructive: false, trackIgnored: false })
          if (resultFailed(result))
            failures.push(`${dialect ?? 'configured dialect'} migrations: ${resultError(result)}`)
        }
      }
      else {
        const { generateRouteNames } = await import('@stacksjs/actions/generate/action-types')
        const { buildDatabaseSchema } = await import('@stacksjs/orm')
        await generateRouteNames({ strict: true })
        const { errors } = await buildDatabaseSchema({ strict: true })
        failures.push(...errors.map(error => `${error.file}: ${error.error}`))
      }
    }
    catch (error) {
      failures.push(`${task}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (failures.length > 0)
    throw new Error(failures.join('\n'))
  if (readGenerationConfig(root)?.autoCommit)
    await commit?.()
}
