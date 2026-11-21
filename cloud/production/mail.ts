import { existsSync, globSync, lstatSync, mkdirSync, realpathSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import process from 'node:process'
import { atomicWrite, command, requirePrivateDirectory, sqliteSnapshot, withScratch } from '../../storage/framework/core/cloud/src/host-backup/io'
import { ResticArchive } from '../../storage/framework/core/cloud/src/host-backup/restic'
import { resticDirectory } from './inventory'

const mailCommand = { discardOutput: true, timeoutMs: 0 }

export function mailBackupPaths(): { mail: string, backups: string } {
  const mail = process.env.MAIL_DIR ?? process.env.MAIL_ROOT ?? '/opt/mail'
  const backups = process.env.BACKUP_DIR ?? join(mail, 'backups')
  if ([mail, backups].some(path => !isAbsolute(path) || resolve(path) === '/'))
    throw new Error('Mail directories must be absolute non-root paths')
  return { mail, backups }
}

function localArchives(backupDir: string): string[] {
  return globSync('mail-backup-*.tgz', { cwd: backupDir }).map(name => join(backupDir, name))
    .filter(path => statSync(path).isFile()).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
}

export async function createMailBackup(): Promise<void> {
  const { mail, backups } = mailBackupPaths()
  const retention = process.env.RETAIN_DAYS ?? '7'
  if (!/^[1-9][0-9]*$/.test(retention) || !Number.isSafeInteger(Number(retention)))
    throw new Error('RETAIN_DAYS must be a positive integer')
  mkdirSync(backups, { recursive: true, mode: 0o700 })
  const resolved = realpathSync(backups)
  if ([resolved, realpathSync(mail)].includes('/'))
    throw new Error('Mail directories must resolve to non-root paths')
  requirePrivateDirectory(resolved)
  const now = new Date().toISOString()
  const timestamp = `${now.slice(0, 10).replaceAll('-', '')}-${now.slice(11, 19).replaceAll(':', '')}`
  const output = join(backups, `mail-backup-${timestamp}.tgz`)
  const envFile = process.env.MAIL_ENV_FILE ?? '/etc/mail/mail.env'
  await withScratch(join(backups, '.mail-backup-'), async (scratch) => {
    const snapshots: string[] = []
    for (const name of ['smtp.db', 'caldav.db']) {
      const path = join(mail, name)
      if (existsSync(path)) {
        await sqliteSnapshot(path, join(scratch, name))
        snapshots.push(name)
      }
    }
    const files = ['mail', 'dkim', 'forwards.json', 'forwards.sieve', 'cert-backups'].filter(name => existsSync(join(mail, name)))
    const partial = join(scratch, 'mail.tgz')
    await command(['tar', '--dereference', '-czf', partial, '-C', mail, ...files, '-C', scratch, ...snapshots], mailCommand)
    await command(['tar', '-tzf', partial], mailCommand)
    const envArchive = join(scratch, 'env.tar')
    if (existsSync(envFile)) {
      await command(['tar', '-cf', envArchive, '-C', dirname(envFile), basename(envFile)], mailCommand)
      await command(['tar', '-tf', envArchive], mailCommand)
      renameSync(envArchive, output.replace(/\.tgz$/, '.env.tar'))
    }
    renameSync(partial, output)
  })
  if (process.env.MAIL_BACKUP_PRESERVE !== '1') {
    const cutoff = Date.now() - (Number(retention) + 1) * 86_400_000
    for (const name of globSync('mail-backup-*', { cwd: backups })) {
      const path = join(backups, name)
      const stat = lstatSync(path)
      if (/^mail-backup-.*(?:\.tgz|\.env\.tar)$/.test(name) && stat.isFile() && stat.mtimeMs < cutoff)
        unlinkSync(path)
    }
  }
  console.log(`Backup written: ${output}`)
}

export async function uploadMailBackup(runLocalBackup: () => Promise<void>): Promise<void> {
  await command(['mountpoint', '-q', '/var/lib/mail-storage'])
  const { backups } = mailBackupPaths()
  const directory = process.env.MAIL_RESTIC_CONFIG_DIR ?? resticDirectory
  const statusFile = process.env.MAIL_RESTIC_STATUS_FILE ?? join(directory, 'last-success')
  const backupScript = process.env.MAIL_BACKUP_SCRIPT
  if (backupScript)
    await command([backupScript], mailCommand)
  else
    await runLocalBackup()
  const latest = localArchives(backups)[0]
  if (!latest)
    throw new Error('No local mail archive was produced')
  await command(['tar', '-tzf', latest], mailCommand)
  const envArchive = latest.replace(/\.tgz$/, '.env.tar')
  const sources = existsSync(envArchive) ? [latest, envArchive] : [latest]
  const failures: string[] = []
  for (const provider of ['aws', 'hetzner']) {
    const config = provider === 'aws' ? process.env.MAIL_RESTIC_ENV ?? join(directory, 'restic.env') : join(directory, 'hetzner.env')
    const status = provider === 'aws' ? statusFile : `${statusFile}-hetzner`
    try {
      const archive = new ResticArchive(config, provider, true)
      const host = (await command(['hostname', '-f']).catch(() => command(['hostname']))).trim()
      await archive.run('backup', '--host', host, '--tag', 'mail', '--tag', 'production', '--', ...sources)
      await archive.run('check')
      if (process.env.MAIL_BACKUP_PRESERVE !== '1')
        await archive.run('forget', '--tag', 'mail', '--group-by', 'tags', '--keep-daily', '7', '--keep-weekly', '5', '--keep-monthly', '12', '--prune')
      mkdirSync(dirname(status), { recursive: true, mode: 0o700 })
      atomicWrite(status, `timestamp=${Math.floor(Date.now() / 1000)}\narchive=${basename(latest)}\nrepository=${archive.repository}\n`)
      console.log(`${provider}: uploaded and checked ${basename(latest)}`)
    }
    catch (error) {
      console.error(`${provider}: mail backup failed`, error instanceof Error ? error.message : '')
      failures.push(provider)
    }
  }
  if (failures.length)
    throw new Error(`Mail backup failed on ${failures.join(', ')}. Local recovery archives are retained.`)
}
