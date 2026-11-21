import { lstatSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { command, envValues } from './io'

export interface MysqlSource {
  binary: string
  database: string
  socket?: string
  user?: string
  env_file?: string
}

export interface BackupSelection {
  files?: string[]
  sqlite?: string[]
  postgres?: string[]
  mysql?: MysqlSource[]
}

export interface BackupInventory {
  repositories: Record<string, string>
  projects: Record<string, BackupSelection>
  staging?: string
  created_at?: number
  retired_databases?: Array<{ name: string, specification: BackupSelection, retired_at: number }>
  legacy_external_databases?: Array<{ project: string, env_file: string, reason: string }>
}

export const postgresCommand = ['runuser', '-u', 'postgres', '--']
export const psql = [...postgresCommand, '/usr/local/bin/psql', '-v', 'ON_ERROR_STOP=1', '-Atc']

export function databaseName(name: string): string {
  if (!/^[a-z0-9_]+$/i.test(name) || !/[a-z0-9]/i.test(name))
    throw new Error('Invalid configured database name')
  return name
}

function isSqlite(path: string): boolean {
  return ['.sqlite', '.db', '.sqlite3'].includes(extname(path))
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false
}

function isDirectory(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
}

function* sqliteFiles(directory: string): Generator<string> {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory())
      yield* sqliteFiles(path)
    else if (isSqlite(path) && isFile(path))
      yield realpathSync(path)
  }
}

export function discoverManagedProjects(webRoot: string, stateRoot = '/var/lib'): Record<string, BackupSelection> {
  const projects = new Map<string, { sqlite: Set<string>, files: Set<string> }>()
  for (const siteName of readdirSync(webRoot).sort()) {
    const site = join(webRoot, siteName)
    const owner = join(site, '.ts-cloud/owner')
    const current = join(site, 'current')
    if (!lstatSync(site).isDirectory() || !isFile(owner) || !lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink())
      continue
    const name = readFileSync(owner, 'utf8').trim()
    if (!/^[a-z0-9_-]+$/i.test(name))
      continue
    let project = projects.get(name)
    if (!project) {
      project = { sqlite: new Set(), files: new Set() }
      projects.set(name, project)
    }
    const shared = join(site, 'shared')
    const env = join(shared, '.env')
    const values = isFile(env) ? envValues(env) : {}
    for (const file of [env, join(shared, '.env.keys')]) {
      if (isFile(file))
        project.files.add(realpathSync(file))
    }
    for (const name of ['public', 'stx-images', 'uploads', 'storage']) {
      const directory = join(shared, name)
      if (!isDirectory(directory))
        continue
      const persistentDirectory = realpathSync(directory)
      project.files.add(persistentDirectory)
      for (const database of sqliteFiles(persistentDirectory))
        project.sqlite.add(database)
    }
    const sharedDatabase = join(webRoot, `${name}-shared/database`)
    if ((values.DB_CONNECTION ?? 'sqlite') === 'sqlite') {
      const configured = values.DB_DATABASE_PATH ?? values.DB_DATABASE
      const candidates = [sharedDatabase, join(stateRoot, name)]
      if (configured && !configured.startsWith('encrypted:'))
        candidates.push(...(isAbsolute(configured) ? [configured] : [join(current, configured), join(shared, configured)]))
      for (const candidate of candidates) {
        if (isSqlite(candidate) && isFile(candidate))
          project.sqlite.add(realpathSync(candidate))
        else if (isDirectory(candidate)) {
          for (const entry of readdirSync(candidate)) {
            const path = join(candidate, entry)
            if (isSqlite(path) && isFile(path))
              project.sqlite.add(realpathSync(path))
          }
        }
      }
    }
    const snapshots = join(sharedDatabase, 'snapshots')
    if (isDirectory(snapshots))
      project.files.add(snapshots)
  }
  return Object.fromEntries([...projects].map(([name, project]) => [name, {
    sqlite: [...project.sqlite].sort(),
    files: [...project.files].sort(),
    postgres: [],
  }]))
}

export async function discoverPostgresDatabases(): Promise<Array<{ name: string, disposable: boolean }>> {
  const output = await command([...psql, `
    SELECT json_build_object('name', d.datname, 'disposable',
      coalesce(shobj_description(d.oid, 'pg_database') = 'stacks:disposable-verification'
      AND r.rolvaliduntil <= now() + interval '24 hours', false))
    FROM pg_database d JOIN pg_roles r ON r.oid = d.datdba
    WHERE NOT d.datistemplate AND d.datname <> 'postgres'`])
  return output.split('\n').filter(Boolean).map(line => JSON.parse(line))
}

export function retireMissingDatabase(inventory: BackupInventory, name: string, liveNames: ReadonlySet<string>): void {
  if (liveNames.has(name))
    throw new Error('A live database cannot be retired from backup selection')
  const selection = Object.hasOwn(inventory.projects, name) ? inventory.projects[name] : undefined
  if (selection?.postgres?.length !== 1 || selection.postgres[0] !== name
    || selection.sqlite?.length || selection.files?.length || selection.mysql?.length)
    throw new Error('Only a missing database-only selection can be retired')
  const retired = inventory.retired_databases ??= []
  retired.push({ name, specification: selection, retired_at: Math.floor(Date.now() / 1000) })
  delete inventory.projects[name]
}
