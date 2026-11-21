import { lstatSync, readdirSync, rmSync, unlinkSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { alreadyArchived, archiveDeploymentBackups, cleanupRestoreChecks, cleanupStaging, deploymentBackups } from '../../storage/framework/core/cloud/src/host-backup/deploy-archives'
import { day, diskUsage, managedSites, processReferences, releaseCandidates, tryFileLock, withSiteLocks } from '../../storage/framework/core/cloud/src/host-backup/maintenance'
import { ResticArchive } from '../../storage/framework/core/cloud/src/host-backup/restic'
import { resticDirectory } from './inventory'

export const hostBackupLock = '/run/lock/host-backup.lock'
const maintenanceLock = '/run/lock/mail-host-maintenance.lock'

export function verifyMailHostCapacity(highWater: number): void {
  if (!Number.isInteger(highWater) || highWater < 1 || highWater >= 100)
    throw new Error('High-water mark must be between 1 and 99')
  const usage = diskUsage('/')
  console.log(`Root disk usage: ${usage}%`)
  if (usage >= highWater)
    throw new Error('Disk remains above high-water. Investigate live data and capacity.')
  console.log('Capacity healthy. Data, backups, and releases are preserved.')
}

interface MaintenanceOptions {
  apply: boolean
  webRoot: string
  mailRoot: string
  highWater: number
  target: number
}

async function retainDeploymentBackups(webRoot: string, apply: boolean): Promise<void> {
  const owners = Map.groupBy(managedSites(webRoot), entry => entry.project)
  const receipts = join(resticDirectory, 'app-backup-receipts')
  let archives: Record<string, ResticArchive> | undefined
  cleanupStaging('/var/cache/host-backup', processReferences(), apply)
  for (const [project, sites] of owners) {
    const shared = join(webRoot, `${project}-shared`)
    const directory = join(shared, 'backups')
    if (!lstatSync(shared, { throwIfNoEntry: false })?.isDirectory() || !lstatSync(directory, { throwIfNoEntry: false })?.isDirectory())
      continue
    const locked = await withSiteLocks(sites.map(entry => entry.site), async () => {
      const referenced = processReferences()
      cleanupRestoreChecks(directory, referenced, apply)
      const plan = deploymentBackups(directory, referenced)
      if (!plan.uploads.length || alreadyArchived(plan, join(receipts, `${project}.uploaded.json`)))
        return
      console.log(`${apply ? 'Archive' : 'Would archive'} ${project}: ${plan.removals.length} old local backups, ${plan.removals.reduce((sum, file) => sum + file.size, 0)} bytes`)
      if (!apply)
        return
      archives ??= {
        aws: new ResticArchive(join(resticDirectory, 'restic.env'), 'aws', true),
        hetzner: new ResticArchive(join(resticDirectory, 'hetzner.env'), 'hetzner', true),
      }
      await archiveDeploymentBackups(directory, project, plan, archives, receipts)
    })
    if (!locked)
      console.log(`Skip backup retention during deployment: ${project}`)
  }
}

function pruneMailBinaries(mailRoot: string, apply: boolean): void {
  const candidates = readdirSync(mailRoot)
    .filter(name => /^mail-server\.bak-\d+$/.test(name))
    .map(name => ({ path: join(mailRoot, name), order: Number(name.slice('mail-server.bak-'.length)) }))
    .filter(({ path }) => lstatSync(path, { throwIfNoEntry: false })?.isFile())
    .sort((a, b) => b.order - a.order)
  for (const { path } of candidates.slice(3)) {
    const stats = lstatSync(path, { throwIfNoEntry: false })
    if (!stats?.isFile() || Date.now() - stats.mtimeMs < 7 * day)
      continue
    console.log(`${apply ? 'Remove' : 'Would remove'} old mail binary: ${path}`)
    if (apply)
      unlinkSync(path)
  }
}

async function pruneReleases(webRoot: string, apply: boolean, target: number): Promise<void> {
  for (const { site } of managedSites(webRoot)) {
    if (apply && diskUsage('/') <= target)
      return
    const locked = await withSiteLocks([site], async () => {
      for (const path of releaseCandidates(site, processReferences())) {
        if (apply && diskUsage('/') <= target)
          return
        console.log(`${apply ? 'Remove' : 'Would remove'} inactive release: ${path}`)
        if (apply && releaseCandidates(site, processReferences()).includes(path))
          rmSync(path, { recursive: true })
      }
    })
    if (!locked)
      console.log(`Skip busy or unmanaged site: ${site}`)
  }
}

export async function maintainMailHost(options: MaintenanceOptions): Promise<void> {
  const { apply, highWater, target } = options
  const webRoot = resolve(options.webRoot)
  const mailRoot = resolve(options.mailRoot)
  if (webRoot === '/' || mailRoot === '/')
    throw new Error('Maintenance roots must be non-root directories')
  if (!Number.isInteger(target) || !Number.isInteger(highWater) || !(0 < target && target < highWater && highWater < 100))
    throw new Error('Need 0 < target < high-water < 100')

  const releaseMaintenance = await tryFileLock(maintenanceLock, true)
  if (!releaseMaintenance) {
    console.log('Maintenance already running. Skipping.')
    return
  }
  try {
    console.log(`Root disk usage before: ${diskUsage('/')}%`)
    let backupFailure: unknown
    const releaseBackup = await tryFileLock(hostBackupLock, true)
    if (releaseBackup) {
      try {
        await retainDeploymentBackups(webRoot, apply)
      }
      catch (error) {
        backupFailure = error
        console.error(`Backup retention failed: ${error instanceof Error ? error.message : error}`)
      }
      finally {
        releaseBackup()
      }
    }
    else {
      console.log('Backup or check running. Deferring archival until the next scan.')
    }
    pruneMailBinaries(mailRoot, apply)
    if (diskUsage('/') >= highWater)
      await pruneReleases(webRoot, apply, target)
    const after = diskUsage('/')
    console.log(`Root disk usage after: ${after}%`)
    if (apply && after >= highWater)
      throw new Error('Disk remains above high-water. Investigate live data and capacity.')
    if (backupFailure)
      throw backupFailure
  }
  finally {
    releaseMaintenance()
  }
}
