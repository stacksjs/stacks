import type { GenerationTask } from '@stacksjs/actions/daemon/generation-config'
import type { SpawnSyncOptionsWithStringEncoding } from 'node:child_process'
import { spawnSync } from 'node:child_process'
import { lstatSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { isGeneratedMigration } from '@stacksjs/database/generated-migration-marker'

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

export function gitCommand(root: string, args: string[], options?: Partial<SpawnSyncOptionsWithStringEncoding>): string {
  const result = spawnSync('git', ['--literal-pathspecs', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 30_000,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  })
  if (result.status !== 0)
    throw new Error(result.error?.message ?? (result.stderr.trim() || `git ${args[0]} failed`))
  return result.stdout
}

export function git(root: string, ...args: string[]): string {
  return gitCommand(root, args)
}

export function gitRevision(root: string): string {
  return git(root, 'rev-parse', 'HEAD', '--symbolic-full-name', 'HEAD')
}

export function generationRevision(root: string): string | undefined {
  try {
    if (!git(root, 'rev-parse', '--show-prefix').trim())
      return gitRevision(root)
  }
  catch {
    // Generation can run before a project has a repository or first commit.
  }
}

export function generatedChanges(root: string, tasks: GenerationTask[], includeIgnored = false) {
  const files = [
    ...(tasks.includes('imports') ? importFiles : []),
    ...(tasks.includes('types') ? typeFiles : []),
  ]
  const migrations = tasks.includes('migrations')
  const scope = [...files, ...(migrations ? migrationDirectories : [])]
  const read = () => {
    const status = git(root, '--no-optional-locks', 'status', '--porcelain=v1', '-z', '--no-renames', '--untracked-files=all',
      ...(includeIgnored && migrations ? ['--ignored=traditional'] : []), '--', ...scope)
    return new Map(status.split('\0').filter(Boolean).map(entry => [entry.slice(3), entry.slice(0, 2)]))
  }
  const eligible = (file: string, status: string) => {
    const fullPath = join(root, file)
    const snapshot = migrations && /^storage\/framework\/database\/model-snapshot\.(?:sqlite|mysql|postgres|singlestore|vitess)\.json$/.test(file)
    const generatedSql = migrations && /^database\/migrations\/(?:[^/]+\/)?\d{10}-.+\.sql$/.test(file)
      && isGeneratedMigration(dirname(fullPath), basename(fullPath))
    if (status === '!!' ? !generatedSql : !files.includes(file) && !snapshot && !generatedSql)
      return false
    return (status === ' M' || status === '??' || status === '!!') && lstatSync(fullPath, { throwIfNoEntry: false })?.isFile() === true
  }
  return { read, eligible }
}

/** Commit only clean-before paths whose contents the requested generators own. */
export function prepareAutomaticCommit(root: string, tasks: GenerationTask[]): (() => void) | undefined {
  const revision = generationRevision(root)
  if (!revision)
    return

  const { read, eligible } = generatedChanges(root, tasks)
  const before = read()
  return () => {
    if (gitRevision(root) !== revision)
      return

    const changes = [...read()].filter(([file, status]) => !before.has(file) && eligible(file, status))
    if (changes.length === 0)
      return
    const newFiles = changes.filter(([, status]) => status === '??').map(([file]) => file)
    if (newFiles.length > 0)
      git(root, 'add', '--intent-to-add', '--', ...newFiles)
    git(root, 'commit', '--only', '-m', 'chore: regenerate Stacks artifacts', '--', ...changes.map(([file]) => file))
  }
}
