import type { BackupInventory } from '../../storage/framework/core/cloud/src/host-backup/inventory'
import { chmodSync, closeSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { runHostBackup } from '../../storage/framework/core/cloud/src/host-backup/backup'
import { command, envValues, readJson, requirePrivateDirectory, requireRoot } from '../../storage/framework/core/cloud/src/host-backup/io'
import { ResticArchive } from '../../storage/framework/core/cloud/src/host-backup/restic'
import { configureInventory, deploymentsVolume, hostSources, inventoryPath } from './inventory'
import { createMailBackup, mailBackupPaths, uploadMailBackup } from './mail'
import { hostBackupLock, maintainMailHost, verifyMailHostCapacity } from './maintenance'

const actions = 'host-backup, inventory, mail-backup, mail-restic-backup, mail-capacity, mail-host-maintenance, snapshot-record, reviewos-credentials'
const [operation, ...args] = process.argv.slice(2)
const compiled = basename(process.execPath) !== 'bun'

async function lock(path: string, wait?: number): Promise<void> {
  // Use the same inode as the existing host jobs. Re-exec under flock so the
  // child holds the lock until its backup, validation and receipt all finish.
  const self = compiled ? [process.execPath] : [process.execPath, import.meta.path]
  const child = Bun.spawn(['flock', '--no-fork', ...(wait ? ['-w', String(wait)] : []), path, ...self, operation, ...args],
    { env: { ...process.env, STACKS_HOST_LOCK: path }, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
  if (await child.exited !== 0)
    throw new Error(`${operation} did not complete`)
}

function createPrivateFile(path: string, contents: unknown): void {
  const fd = openSync(path, 'wx', 0o600)
  try {
    writeFileSync(fd, JSON.stringify(contents))
    fsyncSync(fd)
  }
  finally {
    closeSync(fd)
  }
}

function installReviewOsCredentials(source: string, target: string): void {
  const info = lstatSync(source)
  if (!info.isFile() || info.uid !== 0 || (info.mode & 0o077))
    throw new Error('Source must be a private root-owned regular file')
  const values = envValues(source)
  const accessKeyId = values.HETZNER_S3_ACCESS_KEY || values.AWS_ACCESS_KEY_ID
  const secretAccessKey = values.HETZNER_S3_SECRET_KEY || values.AWS_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey)
    throw new Error('Source has no usable S3 credential pair')
  mkdirSync(dirname(target), { mode: 0o700, recursive: true })
  requirePrivateDirectory(dirname(target))
  const current = lstatSync(target, { throwIfNoEntry: false })
  if (current) {
    if (!current.isFile() || current.uid !== 0 || (current.mode & 0o077))
      throw new Error('Existing credential file must be a private root-owned regular file')
    let previous: { accessKeyId?: string, secretAccessKey?: string }
    try {
      previous = readJson(target)
    }
    catch {
      throw new Error('Existing credential file cannot be read')
    }
    if (previous.accessKeyId !== accessKeyId || previous.secretAccessKey !== secretAccessKey)
      throw new Error('Existing credential file differs. Explicit rotation is required.')
  }
  else {
    createPrivateFile(target, { accessKeyId, secretAccessKey })
  }
  console.log('Protected object storage credential file installed.')
}

function options<const T extends NonNullable<Parameters<typeof parseArgs>[0]>['options']>(options: T) {
  return parseArgs({ args, options }).values
}

async function main(): Promise<void> {
  if (!operation || operation === '--help') {
    console.log(`Usage: stacks-host-ops <command> [options]\nCommands: ${actions}`)
    return
  }
  requireRoot()
  process.umask(0o077)
  switch (operation) {
    case 'host-backup': {
      const flags = options({
        config: { type: 'string', default: inventoryPath },
        check: { type: 'boolean' },
        drill: { type: 'boolean' },
        'retry-failed': { type: 'boolean' },
        'preserve-backups': { type: 'boolean' },
      })
      if (process.env.STACKS_HOST_LOCK !== hostBackupLock)
        return lock(hostBackupLock)
      const inventory = readJson<BackupInventory>(flags.config)
      if (flags.drill || inventory.staging?.startsWith(`${deploymentsVolume}/`))
        await command(['mountpoint', '-q', deploymentsVolume])
      const drillDirectory = join(deploymentsVolume, 'host-restore-drills')
      if (flags.drill) {
        mkdirSync(drillDirectory, { recursive: true, mode: 0o700 })
        const directory = lstatSync(drillDirectory)
        if (!directory.isDirectory() || directory.uid !== 0 || (directory.mode & 0o066))
          throw new Error('Restore drill directory must be root-owned with private contents')
        // PostgreSQL runs as its own user. It can traverse this directory to
        // its private instance without listing the other temporary copies.
        chmodSync(drillDirectory, 0o711)
      }
      await runHostBackup(inventory, join(dirname(inventoryPath), 'host-backup-status.json'), {
        check: flags.check,
        drill: flags.drill,
        drillDirectory,
        retryFailed: flags['retry-failed'],
        preserveBackups: flags['preserve-backups'],
        hostSources,
        onRecovered: () => command(['systemctl', 'reset-failed', 'host-app-backup.service']).then(() => {}),
      })
      return
    }
    case 'inventory': {
      const flags = options({ apply: { type: 'boolean' }, 'retire-missing-database': { type: 'string' } })
      if (process.env.STACKS_HOST_LOCK !== hostBackupLock)
        return lock(hostBackupLock)
      await configureInventory({ apply: flags.apply, retire: flags['retire-missing-database'] })
      return
    }
    case 'mail-backup': {
      options({})
      const { backups } = mailBackupPaths()
      mkdirSync(backups, { recursive: true, mode: 0o700 })
      const directory = realpathSync(backups)
      if (directory === '/')
        throw new Error('Backup directory must resolve to a non-root path')
      const path = join(directory, '.mail-backup.lock')
      requirePrivateDirectory(dirname(path))
      if (process.env.STACKS_HOST_LOCK !== path)
        return lock(path, 600)
      await createMailBackup()
      return
    }
    case 'mail-restic-backup': {
      options({})
      if (process.env.STACKS_HOST_LOCK !== hostBackupLock)
        return lock(hostBackupLock, 3600)
      await uploadMailBackup(async () => {
        const self = compiled ? [process.execPath] : [process.execPath, import.meta.path]
        await command([...self, 'mail-backup'], { discardOutput: true, timeoutMs: 0 })
      })
      return
    }
    case 'mail-capacity':
      verifyMailHostCapacity(Number(options({ 'high-water': { type: 'string', default: '85' } })['high-water']))
      return
    case 'mail-host-maintenance': {
      const flags = options({
        apply: { type: 'boolean' },
        'verify-only': { type: 'boolean' },
        'web-root': { type: 'string', default: '/var/www' },
        'mail-root': { type: 'string', default: '/opt/mail' },
        'high-water': { type: 'string', default: '85' },
        target: { type: 'string', default: '75' },
      })
      if (flags['verify-only']) {
        verifyMailHostCapacity(Number(flags['high-water']))
        return
      }
      await maintainMailHost({
        apply: flags.apply === true,
        webRoot: flags['web-root'],
        mailRoot: flags['mail-root'],
        highWater: Number(flags['high-water']),
        target: Number(flags.target),
      })
      return
    }
    case 'snapshot-record': {
      const { verify, record } = options({ verify: { type: 'boolean' }, record: { type: 'string' } })
      if (!record)
        throw new Error('--record is required')
      const { repositories } = readJson<BackupInventory>(inventoryPath)
      const original = verify ? readJson<Record<string, string[]>>(record) : undefined
      const current: Record<string, string[]> = {}
      for (const [provider, file] of Object.entries(repositories)) {
        const snapshots = await new ResticArchive(file, provider).snapshots()
        current[provider] = snapshots.map(item => item.id).sort()
      }
      if (original) {
        for (const [provider, ids] of Object.entries(original)) {
          const retained = new Set(current[provider])
          if (ids.some(id => !retained.has(id)))
            throw new Error(`${provider}: original snapshots are missing`)
          console.log(`${provider}: all ${ids.length} original snapshots preserved; ${retained.size} present`)
        }
      }
      else {
        createPrivateFile(record, current)
        console.log(JSON.stringify(Object.fromEntries(Object.entries(current).map(([name, ids]) => [name, ids.length]))))
      }
      return
    }
    case 'reviewos-credentials': {
      const { source, target } = options({
        source: { type: 'string' },
        target: { type: 'string', default: '/var/www/reviewos-shared/credentials/object-storage.json' },
      })
      if (!source)
        throw new Error('--source is required')
      installReviewOsCredentials(source, target)
      return
    }
    default:
      throw new Error(`Unknown command. Available commands: ${actions}`)
  }
}

try {
  await main()
}
catch (error) {
  console.error(error instanceof Error ? error.message : 'Host operator failed')
  process.exitCode = 1
}
