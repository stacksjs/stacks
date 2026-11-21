import type { BackupInventory, BackupSelection, MysqlSource } from './inventory'
import { existsSync, lstatSync, mkdirSync, realpathSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { databaseName, postgresCommand, psql } from './inventory'
import { atomicDump, command, digest, envValues, freeBytes, GiB, readJson, requirePrivateDirectory, saveJson, sqliteSnapshot, validateSqlite, withScratch } from './io'
import { mysqlRecovery, postgresRecovery } from './recovery'
import { ResticArchive } from './restic'

export const stagingMarker = '.host-backup-managed'
const defaultStage = '/var/cache/host-backup'
const maxBackupAge = 36 * 3600
const epoch = () => Math.floor(Date.now() / 1000)

interface RecoveryReceipt {
  timestamp: number
  source_timestamp?: number
  snapshot: string
  databases: number
  restore_verified: boolean
}

type ProjectStatus = Record<string, RecoveryReceipt | string | undefined> & { error?: string }

export interface BackupStatus {
  checks?: Record<string, { partition: number, timestamp: number }>
  drills?: Record<string, number>
  projects?: Record<string, ProjectStatus>
}

export function projectBackupDue(status: ProjectStatus, repositories: Record<string, string>, now: number): boolean {
  return Boolean(status.error) || Object.keys(repositories).some((provider) => {
    const receipt = status[provider]
    if (!receipt || typeof receipt === 'string' || !receipt.restore_verified)
      return true
    const age = now - receipt.timestamp
    return !(age >= 0 && age <= maxBackupAge)
  })
}

function allProjectsRecovered(inventory: BackupInventory, state: BackupStatus, now: number): boolean {
  return Object.keys(inventory.projects).every((project) => {
    const status = state.projects && Object.hasOwn(state.projects, project) ? state.projects[project] : undefined
    return !projectBackupDue(status ?? {}, inventory.repositories, now)
  })
}

async function mysqlDump(root: string, target: string, source: MysqlSource): Promise<void> {
  const database = databaseName(source.database)
  await withScratch(join(root, 'mysql-options-'), async (scratch) => {
    const client = join(scratch, 'client.cnf')
    const values = source.env_file ? envValues(source.env_file) : {}
    const connection = source.socket
      ? { socket: source.socket }
      : { host: values.DB_HOST, port: values.DB_PORT ?? '3306', password: values.DB_PASSWORD ?? '', 'ssl-mode': 'REQUIRED' }
    if (!source.socket && !connection.host)
      throw new Error('MySQL backup has no configured host')
    // A private option file keeps credentials outside command arguments.
    const fields = { user: source.user ?? values.DB_USERNAME ?? 'root', ...connection }
    const settings = Object.entries(fields).filter(([, value]) => value !== undefined)
    writeFileSync(client, `[client]\n${settings.map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n')}\n`, { mode: 0o600 })
    const optionFile = `--defaults-extra-file=${client}`
    const bytes = await command([join(dirname(source.binary), 'mysql'), optionFile, '--batch', '--skip-column-names', '--execute',
      `SELECT COALESCE(SUM(data_length+index_length),0) FROM information_schema.tables WHERE table_schema='${database}'`])
    if (!Number.isFinite(Number(bytes)) || freeBytes(root) < Number(bytes) * 4 + 2 * GiB)
      throw new Error('Insufficient MySQL snapshot/recovery space')
    await atomicDump(target, [source.binary, optionFile, '--single-transaction', '--quick', '--skip-lock-tables', '--no-tablespaces',
      '--set-gtid-purged=OFF', '--hex-blob', '--column-statistics=0',
      ...(source.socket ? ['--routines', '--events', '--triggers'] : []), database])
  })
}

type Archive = Pick<ResticArchive, 'run' | 'restore' | 'restoreVerifiedFile' | 'snapshots'>

interface BackupOptions {
  profile?: 'project-rpo'
  check?: boolean
  drill?: boolean
  drillDirectory?: string
  retryFailed?: boolean
  preserveBackups?: boolean
  hostSources?: (project: string, root: string) => Promise<string[]>
  onRecovered?: () => Promise<void>
}

async function backupProject(
  project: string,
  selection: BackupSelection,
  archives: Record<string, Archive>,
  stage: string,
  status: ProjectStatus,
  options: BackupOptions,
  persist: () => void,
): Promise<void> {
  // Count age from before the database snapshot, even if upload took minutes.
  const sourceTimestamp = epoch()
  const root = join(stage, project)
  const databases = join(root, 'databases')
  mkdirSync(databases, { recursive: true, mode: 0o700 })
  requirePrivateDirectory(root)
  requirePrivateDirectory(databases)
  const sources = await options.hostSources?.(project, root) ?? []
  const mapping: Record<string, { source: string, engine: 'sqlite' | 'postgres' | 'mysql', sha256: string }> = {}
  for (const [index, source] of (selection.sqlite ?? []).entries()) {
    const target = join(databases, `${index}-${basename(source)}`)
    if (freeBytes(root) < statSync(source).size * 2 + GiB)
      throw new Error('Insufficient space for SQLite snapshot and recovery')
    await sqliteSnapshot(source, target)
    sources.push(target)
    mapping[target] = { source, engine: 'sqlite', sha256: await digest(target) }
  }
  for (const name of selection.postgres ?? []) {
    const database = databaseName(name)
    const target = join(databases, `${database}.dump`)
    const bytes = await command([...psql, `SELECT pg_database_size('${database}')`])
    if (!Number.isFinite(Number(bytes)) || freeBytes(root) < Number(bytes) * 2 + 2 * GiB)
      throw new Error('Insufficient PostgreSQL snapshot/recovery space')
    await atomicDump(target, [...postgresCommand, '/usr/local/bin/pg_dump', '--format=custom', '--no-owner', '--dbname', database],
      path => command(['/usr/local/bin/pg_restore', '--list', path]))
    sources.push(target)
    mapping[target] = { source: database, engine: 'postgres', sha256: await digest(target) }
  }
  for (const [index, source] of (selection.mysql ?? []).entries()) {
    const target = join(databases, `mysql-${index}-${databaseName(source.database)}.sql`)
    await mysqlDump(root, target, source)
    sources.push(target)
    mapping[target] = { source: source.database, engine: 'mysql', sha256: await digest(target) }
  }
  const exclusions: string[] = []
  for (const path of selection.files ?? []) {
    const source = realpathSync(path)
    sources.push(source)
    // Keep committed online snapshots and exclude raw database files and WALs.
    if (statSync(source).isDirectory() && basename(source) !== 'snapshots') {
      for (const pattern of ['**/*.sqlite', '**/*.db', '**/*.sqlite3', '**/*-wal', '**/*-shm', '**/*-journal', '**/logs/**', '**/cache/**', '**/framework/**'])
        exclusions.push('--exclude', join(source, pattern))
    }
  }
  const manifest = join(root, 'recovery.json')
  saveJson(manifest, { project, created: epoch(), sourceTimestamp, databases: mapping, files: selection.files ?? [] })
  sources.push(manifest)

  const failures: string[] = []
  const upload = async ([provider, archive]: [string, Archive]) => {
    try {
      console.log(`${project}: ${provider} uploading persistent files and consistent databases`)
      const output = await archive.run('backup', '--json', '--tag', options.profile ?? 'app-daily', '--tag', 'production', '--tag', `project:${project}`, ...exclusions, '--', ...sources)
      const summary = output.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line))
        .find(record => record.message_type === 'summary')
      const snapshot: string | undefined = summary?.snapshot_id
      if (!snapshot)
        throw new Error('Backup returned no snapshot ID')
      await withScratch(join(root, 'restore-'), async (scratch) => {
        const restored = join(scratch, 'recovered')
        for (const [file, record] of Object.entries(mapping)) {
          await archive.restore(snapshot, file, restored)
          if (await digest(restored) !== record.sha256)
            throw new Error('Database recovery checksum mismatch')
          if (record.engine === 'sqlite')
            validateSqlite(restored)
          else if (record.engine === 'postgres')
            await command(['/usr/local/bin/pg_restore', '--list', restored])
        }
        await archive.restore(snapshot, manifest, restored)
        if (await digest(restored) !== await digest(manifest))
          throw new Error('Recovery manifest checksum mismatch')
      })
      status[provider] = { timestamp: epoch(), source_timestamp: sourceTimestamp, snapshot, databases: Object.keys(mapping).length, restore_verified: true }
      if (options.profile) persist()
      console.log(`${project}: ${provider} uploaded and restored (${Object.keys(mapping).length} databases)`)
    }
    catch (error) {
      failures.push(`${provider}: ${error instanceof Error ? error.message : error}`)
    }
  }
  if (options.profile) await Promise.all(Object.entries(archives).map(upload))
  else for (const archive of Object.entries(archives)) await upload(archive)
  if (failures.length)
    throw new Error(failures.join(', '))
  for (const path of Object.keys(mapping)) {
    if (lstatSync(path, { throwIfNoEntry: false })?.isFile())
      unlinkSync(path)
  }
}

async function recoveryDrill(inventory: BackupInventory, archives: Record<string, Archive>, state: BackupStatus, statePath: string, directory: string, profile = 'app-daily'): Promise<void> {
  const drills = state.drills ??= {}
  for (const [project, selection] of Object.entries(inventory.projects)) {
    const postgres = selection.postgres ?? []
    const mysql = (selection.mysql ?? []).map((source, index) => ({ source, index })).filter(item => item.source.socket)
    if (postgres.length === 0 && mysql.length === 0)
      continue
    const root = join(inventory.staging ?? defaultStage, project, 'databases')
    for (const [provider, archive] of Object.entries(archives)) {
      const snapshots = await archive.snapshots('--latest', '1', '--tag', `${profile},project:${project}`)
      const snapshot = snapshots.sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0]
      if (!snapshot)
        throw new Error(`${project}: no ${provider} recovery snapshot`)
      console.log(`${project}: ${provider} starting restore drill (${postgres.length} PostgreSQL, ${mysql.length} Vitess)`)
      for (const database of postgres) {
        await withScratch(join(directory, 'host-drill-'), async (scratch) => {
          const dump = join(scratch, 'database.dump')
          await archive.restoreVerifiedFile(snapshot.id, join(root, `${databaseName(database)}.dump`), dump)
          await postgresRecovery(dump, directory)
        })
      }
      if (profile === 'project-rpo' && selection.files?.length) {
        await withScratch(join(directory, 'host-files-drill-'), async (scratch) => {
          const paths = selection.files!.map(path => realpathSync(path))
          const includes = paths.flatMap(path => ['--include', path.replace(/[\\*?()[\]{}]/g, '\\$&')])
          await archive.run('restore', snapshot.id, '--verify', '--target', scratch, ...includes)
          for (const path of paths) lstatSync(join(scratch, path))
        })
      }
      for (const { source, index } of mysql) {
        await withScratch(join(directory, 'host-drill-'), async (scratch) => {
          const dump = join(scratch, 'database.sql')
          await archive.restoreVerifiedFile(snapshot.id, join(root, `mysql-${index}-${databaseName(source.database)}.sql`), dump)
          await mysqlRecovery(dump, source.database, source.binary, directory)
        })
      }
      drills[`${project}:${provider}`] = epoch()
      saveJson(statePath, state)
      console.log(`${project}: ${provider} recovered into isolated database instances (${postgres.length} PostgreSQL, ${mysql.length} Vitess)`)
    }
  }
}

export async function runHostBackup(
  inventory: BackupInventory,
  statePath: string,
  options: BackupOptions,
  archives: Record<string, Archive> = Object.fromEntries(Object.entries(inventory.repositories)
    .map(([provider, config]) => [provider, new ResticArchive(config, provider)])),
): Promise<void> {
  if (Object.keys(archives).length === 0)
    throw new Error('No backup repositories configured')
  for (const project of Object.keys(inventory.projects)) {
    if (!/^[a-z0-9_-]+$/i.test(project))
      throw new Error('Invalid backup project name')
  }
  const state: BackupStatus = existsSync(statePath) ? readJson(statePath) : {}
  if (options.drill) {
    await recoveryDrill(inventory, archives, state, statePath, options.drillDirectory ?? '/var/tmp', options.profile)
    return
  }
  if (options.check) {
    const checks = state.checks ??= {}
    for (const [provider, archive] of Object.entries(archives)) {
      const partition = (checks[provider]?.partition ?? 0) % 7 + 1
      await archive.run('check', `--read-data-subset=${partition}/7`)
      checks[provider] = { partition, timestamp: epoch() }
      saveJson(statePath, state)
      console.log(`${provider}: repository check ${partition}/7 passed`)
    }
    return
  }

  const retryAt = epoch()
  if (options.retryFailed && allProjectsRecovered(inventory, state, retryAt)) {
    console.log('All app backups are fresh and recovery-verified')
    return
  }
  const stage = inventory.staging ?? defaultStage
  mkdirSync(stage, { recursive: true, mode: 0o700 })
  requirePrivateDirectory(stage)
  writeFileSync(join(stage, stagingMarker), 'managed disposable database dump staging\n', { mode: 0o600 })
  const failures: string[] = []
  const projects = state.projects = Object.assign(Object.create(null) as Record<string, ProjectStatus>, state.projects)
  for (const [project, selection] of Object.entries(inventory.projects)) {
    const previous = projects[project] ??= {}
    if (options.retryFailed && !projectBackupDue(previous, inventory.repositories, retryAt))
      continue
    try {
      await backupProject(project, selection, archives, stage, previous, options, () => saveJson(statePath, state))
      delete previous.error
    }
    catch (error) {
      previous.error = error instanceof Error ? error.message : String(error)
      failures.push(project)
      console.error(`${project}: backup failed: ${previous.error}`)
    }
    projects[project] = previous
    saveJson(statePath, state)
  }
  if (failures.length)
    throw new Error(`Backup failures: ${failures.join(', ')}`)
  if (!options.preserveBackups && !options.profile) {
    for (const archive of Object.values(archives))
      await archive.run('forget', '--tag', 'app-daily', '--group-by', 'tags', '--keep-daily', '7', '--keep-weekly', '5', '--keep-monthly', '12', '--prune')
  }
  if (options.retryFailed && allProjectsRecovered(inventory, state, epoch()))
    await options.onRecovered?.()
}
