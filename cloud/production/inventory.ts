import type { BackupInventory, BackupSelection } from '../../storage/framework/core/cloud/src/host-backup/inventory'
import { copyFileSync, existsSync, globSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { discoverManagedProjects, discoverPostgresDatabases, retireMissingDatabase } from '../../storage/framework/core/cloud/src/host-backup/inventory'
import { atomicDump, command, envValues, readJson, saveJson } from '../../storage/framework/core/cloud/src/host-backup/io'

export const resticDirectory = '/var/lib/mail-storage/data/restic'
export const inventoryPath = join(resticDirectory, 'host-backup.json')
export const deploymentsVolume = '/var/lib/stacks-deployments'
const webRoot = '/var/www'

export async function configureInventory(options: { apply?: boolean, retire?: string }): Promise<void> {
  const databases = await discoverPostgresDatabases()
  if (options.retire !== undefined) {
    const inventory = readJson<BackupInventory>(inventoryPath)
    retireMissingDatabase(inventory, options.retire, new Set(databases.map(row => row.name)))
    if (!options.apply) {
      console.log('Reviewed retirement only. Pass --apply to update selection. Backups remain intact.')
      return
    }
    const archive = join(deploymentsVolume, 'recovery/backup-inventories')
    await command(['mountpoint', '-q', deploymentsVolume])
    mkdirSync(archive, { recursive: true, mode: 0o700 })
    copyFileSync(inventoryPath, join(archive, `inventory-before-retirement-${Date.now()}-${crypto.randomUUID()}.json`))
    saveJson(inventoryPath, inventory)
    console.log('Retired missing database selection. The prior inventory and every backup are preserved.')
    return
  }

  const projects = Object.assign(Object.create(null) as Record<string, BackupSelection>, discoverManagedProjects(webRoot))
  const select = (name: string) => projects[name] ??= { sqlite: [], postgres: [], files: [] }
  for (const row of databases) {
    if (!row.disposable)
      (select(row.name).postgres ??= []).push(row.name)
  }
  select('host-config').files = ['/etc/mail', '/etc/systemd/system', join(resticDirectory, 'app-backup-receipts')]

  // Back up the physical Vitess shard through its private socket.
  const binary = '/opt/pantry/pantry/mysql.com/v8.0.43/bin/mysqldump'
  const sockets = globSync('/var/lib/vitess/vt_*/mysql.sock').sort()
  if (sockets.length) {
    const predict = select('predicthq')
    predict.mysql = sockets.map(socket => ({ binary, socket, database: 'vt_predicthq', user: 'root' }))
    const files = predict.files ??= []
    files.push('/usr/local/lib/vitess')
  }

  const previous = existsSync(inventoryPath) ? readJson<BackupInventory>(inventoryPath) : undefined
  const inventory: BackupInventory = {
    repositories: { aws: join(resticDirectory, 'restic.env'), hetzner: join(resticDirectory, 'hetzner.env') },
    created_at: previous?.created_at ?? Math.floor(Date.now() / 1000),
    staging: join(deploymentsVolume, 'host-backup-staging'),
    projects,
    retired_databases: previous?.retired_databases ?? [],
  }
  const ghostEnv = join(webRoot, 'ghostanalytics-main/shared/.env')
  const ghost = existsSync(ghostEnv) ? envValues(ghostEnv) : {}
  const running = await command(['systemctl', 'list-units', '--type=service', '--state=running', '--no-legend', '--plain'])
  if (ghost.DB_CONNECTION === 'singlestore') {
    if (running.split('\n').some(line => line.trimStart().startsWith('ghostanalytics-'))
      && ghost.DB_DATABASE && ghost.DB_HOST && !ghost.DB_HOST.startsWith('encrypted:')) {
      select('ghostanalytics').mysql = [{ binary, env_file: ghostEnv, database: ghost.DB_DATABASE }]
    }
    else {
      inventory.legacy_external_databases = [{
        project: 'ghostanalytics',
        env_file: ghostEnv,
        reason: 'No usable live GhostAnalytics database configuration. Legacy configuration is preserved.',
      }]
    }
  }
  for (const [name, selection] of Object.entries(previous?.projects ?? {})) {
    const project = select(name)
    for (const key of ['sqlite', 'postgres', 'files'] as const)
      project[key] = [...new Set([...(project[key] ?? []), ...(selection[key] ?? [])])].sort()
    // Operator-supplied MySQL configurations are kept. The two managed
    // selections above are rediscovered on each run.
    if (name !== 'ghostanalytics' && name !== 'predicthq' && selection.mysql)
      project.mysql ??= selection.mysql
  }
  for (const [name, selection] of Object.entries(projects)) {
    if (!Object.values(selection).some(entries => entries.length))
      delete projects[name]
  }
  saveJson(inventoryPath, inventory)
  console.log(`Configured ${Object.keys(projects).length} app groups`)
}

const postgresRoles = `
SELECT 'CREATE ROLE ' || quote_ident(rolname) || ' WITH ' ||
  CASE WHEN rolcanlogin THEN 'LOGIN ' ELSE 'NOLOGIN ' END ||
  CASE WHEN rolsuper THEN 'SUPERUSER ' ELSE 'NOSUPERUSER ' END ||
  CASE WHEN rolcreatedb THEN 'CREATEDB ' ELSE 'NOCREATEDB ' END ||
  CASE WHEN rolcreaterole THEN 'CREATEROLE ' ELSE 'NOCREATEROLE ' END ||
  CASE WHEN rolreplication THEN 'REPLICATION ' ELSE 'NOREPLICATION ' END ||
  CASE WHEN rolbypassrls THEN 'BYPASSRLS ' ELSE 'NOBYPASSRLS ' END ||
  CASE WHEN rolinherit THEN 'INHERIT ' ELSE 'NOINHERIT ' END ||
  'CONNECTION LIMIT ' || rolconnlimit ||
  CASE WHEN rolpassword IS NULL THEN '' ELSE ' PASSWORD ' || quote_literal(rolpassword) END || ';'
  FROM pg_authid WHERE rolname !~ '^pg_';
SELECT 'GRANT ' || quote_ident(r.rolname) || ' TO ' || quote_ident(m.rolname) ||
  CASE WHEN a.admin_option THEN ' WITH ADMIN OPTION' ELSE '' END || ';'
  FROM pg_auth_members a JOIN pg_roles r ON r.oid=a.roleid JOIN pg_roles m ON m.oid=a.member;`

export async function hostSources(project: string, root: string): Promise<string[]> {
  if (project !== 'host-config')
    return []
  // This host ships pg_dump without pg_dumpall. The private role export is
  // included only in the encrypted backup and reviewed before a live restore.
  const target = join(root, 'postgres-roles.sql')
  await atomicDump(target, ['runuser', '-u', 'postgres', '--', '/usr/local/bin/psql', '-v', 'ON_ERROR_STOP=1', '-Atc', postgresRoles])
  return [target]
}
