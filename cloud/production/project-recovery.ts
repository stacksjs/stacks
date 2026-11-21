import type { BackupStatus } from '../../storage/framework/core/cloud/src/host-backup/backup'
import { existsSync, lstatSync, mkdirSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import process from 'node:process'
import { runHostBackup } from '../../storage/framework/core/cloud/src/host-backup/backup'
import { databaseName } from '../../storage/framework/core/cloud/src/host-backup/inventory'
import { command, readJson, requirePrivateDirectory, requireRoot, saveJson } from '../../storage/framework/core/cloud/src/host-backup/io'
import { staleRecoveryProviders } from '../../storage/framework/core/cloud/src/host-backup/project-recovery'
import { ResticArchive } from '../../storage/framework/core/cloud/src/host-backup/restic'

const deploymentsVolume = '/var/lib/stacks-deployments'
const notifier = '/usr/local/bin/ts-cloud-notify'
const providers = ['aws', 'hetzner'] as const
const [action, selection] = process.argv.slice(2)

interface ProjectRecoveryConfig {
  files?: string[]
  notify?: boolean
}

function privateFile(path: string): string {
  const info = lstatSync(path)
  if (!info.isFile() || info.uid !== 0 || (info.mode & 0o077)) throw new Error('Recovery credentials and configuration must be private root-owned files')
  return path
}

async function main(): Promise<void> {
  if (action === '--help') {
    console.log('Usage: stacks-project-recovery init|backup|check|drill <postgres-database>')
    return
  }
  if (!selection || process.argv.length !== 4 || !['init', 'backup', 'check', 'drill'].includes(action)) throw new Error('Select a supported project recovery command and database')
  requireRoot()
  process.umask(0o077)
  const project = databaseName(selection)
  await command(['mountpoint', '-q', deploymentsVolume])
  const parent = join(deploymentsVolume, 'project-recovery')
  const root = join(parent, project)
  requirePrivateDirectory(parent)
  requirePrivateDirectory(root)
  const config = readJson<ProjectRecoveryConfig>(privateFile(join(root, 'config.json')))
  if (config.files?.some(path => !isAbsolute(path) || path === '/')) throw new Error('Recovery paths must be specific absolute file or directory paths')
  const state = join(root, action === 'drill' ? 'drill-status.json' : 'status.json')

  if (action === 'check') {
    const healthPath = join(root, 'health.json')
    const current = existsSync(state) ? readJson<BackupStatus>(state) : {}
    const stale = staleRecoveryProviders(current, project, providers, Math.floor(Date.now() / 1000))
    const previous = existsSync(healthPath) ? readJson<{ stale: string[] }>(healthPath).stale : []
    const message = stale.length ? `${project}: 15-minute off-host recovery point missing for ${stale.join(', ')}` : `${project}: off-host recovery point is current in AWS and Hetzner`
    if (stale.join(',') !== previous.join(',')) {
      await command(['logger', '-t', 'stacks-project-recovery', '-p', stale.length ? 'daemon.err' : 'daemon.notice', '--', message])
      if (config.notify) await command([notifier, message], { timeoutMs: 15000 })
      saveJson(healthPath, { stale })
    }
    if (stale.length) throw new Error(message)
    console.log(message)
    return
  }

  const lock = join(root, action === 'drill' ? 'drill.lock' : 'backup.lock')
  if (process.env.STACKS_PROJECT_RECOVERY_LOCK !== lock) {
    const self = basename(process.execPath) === 'bun' ? [process.execPath, import.meta.path] : [process.execPath]
    const child = Bun.spawn(['flock', '--no-fork', '-n', lock, ...self, action, project], {
      env: { ...process.env, STACKS_PROJECT_RECOVERY_LOCK: lock }, stdout: 'inherit', stderr: 'inherit', stdin: 'ignore',
    })
    if (await child.exited !== 0) throw new Error(`${action} did not complete for ${project}`)
    return
  }

  const repositories = Object.fromEntries(providers.map(provider => [provider, privateFile(join(root, `${provider}.env`))]))
  const policy = action === 'backup' ? { lock: '10s', timeoutMs: 60000 } : undefined
  const archives = Object.fromEntries(providers.map(provider => [provider, new ResticArchive(repositories[provider], provider, true, policy)]))
  if (new Set(Object.values(archives).map(archive => archive.repository)).size !== providers.length || Object.values(archives).some(archive => !archive.repository.startsWith('s3:') || !archive.repository.endsWith(`/project-recovery/${project}`)))
    throw new Error('Both off-host repositories must use distinct project-recovery prefixes')

  if (action === 'init') {
    for (const archive of Object.values(archives)) {
      try { await archive.run('cat', 'config') }
      catch { await archive.run('init') }
    }
    return
  }

  const drillDirectory = join(deploymentsVolume, 'host-restore-drills')
  if (action === 'drill') {
    mkdirSync(drillDirectory, { recursive: true, mode: 0o711 })
    const info = lstatSync(drillDirectory)
    if (!info.isDirectory() || info.uid !== 0 || (info.mode & 0o066)) throw new Error('Restore drills require a private root-owned directory')
  }
  await runHostBackup({
    repositories,
    projects: { [project]: { postgres: [project], files: config.files } },
    staging: join(root, 'staging'),
  }, state, { profile: 'project-rpo', drill: action === 'drill', drillDirectory }, archives)
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
