import { closeSync, constants, fchmodSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { stagingMarker } from './backup'
import { digest, freeBytes, readJson, saveJson, withScratch } from './io'
import { day, isReferenced } from './maintenance'

const restoreMarker = '.mail-host-restore-check'
const restoreMarkerContent = 'disposable off-host restore copy\n'
const backupName = /^\d{4}-\d{2}-\d{2}T[\d-]+\.(sqlite|postgres|mysql)\.(sqlite|sql)$/
const appTag = 'app-deploy'
const twoHours = 7_200_000

interface BackupFile {
  path: string
  fingerprint: string
  size: number
  mtime: number
}

export interface DeployArchive {
  run: (...args: string[]) => Promise<string>
  restore: (snapshot: string, path: string, destination: string) => Promise<void>
}

function backupFile(path: string): BackupFile | undefined {
  const stats = lstatSync(path, { throwIfNoEntry: false, bigint: true })
  if (!stats?.isFile() || stats.size === 0n)
    return
  return {
    path,
    size: Number(stats.size),
    mtime: Number(stats.mtimeMs),
    fingerprint: [stats.dev, stats.ino, stats.size, stats.mtimeNs, stats.ctimeNs].map(String).join(':'),
  }
}

export function cleanupStaging(directory: string, references: ReadonlySet<string>, apply: boolean, now = Date.now()): void {
  const marker = join(directory, stagingMarker)
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()
    || !lstatSync(marker, { throwIfNoEntry: false })?.isFile()
    || readFileSync(marker, 'utf8') !== 'managed disposable database dump staging\n')
    return
  for (const project of readdirSync(directory, { withFileTypes: true })) {
    if (!project.isDirectory())
      continue
    const databases = join(directory, project.name, 'databases')
    if (!lstatSync(databases, { throwIfNoEntry: false })?.isDirectory())
      continue
    for (const name of readdirSync(databases)) {
      const path = join(databases, name)
      const stat = lstatSync(path, { throwIfNoEntry: false })
      if (!name.endsWith('.partial') || !stat?.isFile() || now - stat.mtimeMs < twoHours || isReferenced(path, references))
        continue
      console.log(`${apply ? 'Remove' : 'Would remove'} abandoned partial dump: ${path}`)
      if (apply)
        unlinkSync(path)
    }
  }
}

export function cleanupRestoreChecks(directory: string, references: ReadonlySet<string>, apply: boolean, now = Date.now()): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.name.startsWith('.restore-check-') || !entry.isDirectory())
      continue
    const path = join(directory, entry.name)
    const marker = join(path, restoreMarker)
    const stats = lstatSync(marker, { throwIfNoEntry: false })
    if (!stats?.isFile() || now - stats.mtimeMs < twoHours
      || readFileSync(marker, 'utf8') !== restoreMarkerContent || isReferenced(path, references))
      continue
    console.log(`${apply ? 'Remove' : 'Would remove'} abandoned restore-check copy: ${path}`)
    if (apply)
      rmSync(path, { recursive: true })
  }
}

export function deploymentBackups(directory: string, references: ReadonlySet<string>, now = Date.now()): { uploads: BackupFile[], removals: BackupFile[] } {
  const groups = new Map<string, BackupFile[]>()
  for (const name of readdirSync(directory).sort().reverse()) {
    const match = backupName.exec(name)
    const path = join(directory, name)
    if (!match || isReferenced(path, references))
      continue
    const entry = backupFile(path)
    if (!entry)
      continue
    const key = `${match[1]}.${match[2]}`
    const group = groups.get(key) ?? []
    group.push(entry)
    groups.set(key, group)
  }
  const uploads: BackupFile[] = []
  const removals: BackupFile[] = []
  for (const files of groups.values()) {
    uploads.push(...files.filter(file => now - file.mtime >= 600_000))
    removals.push(...files.slice(2).filter(file => now - file.mtime >= day))
  }
  return { uploads, removals }
}

function appendReceipt(path: string, receipt: object): void {
  const flags = constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW
  const fd = openSync(path, flags, 0o600)
  try {
    fchmodSync(fd, 0o600)
    writeFileSync(fd, `${JSON.stringify(receipt)}\n`)
    fsyncSync(fd)
  }
  finally {
    closeSync(fd)
  }
  const directory = openSync(dirname(path), constants.O_RDONLY | constants.O_DIRECTORY)
  try {
    fsyncSync(directory)
  }
  finally {
    closeSync(directory)
  }
}

type BackupPlan = ReturnType<typeof deploymentBackups>

export function alreadyArchived(plan: BackupPlan, manifest: string): boolean {
  if (plan.removals.length || !lstatSync(manifest, { throwIfNoEntry: false })?.isFile())
    return false
  const recorded = readJson<Record<string, unknown>>(manifest)
  return Object.keys(recorded).length === plan.uploads.length && plan.uploads.every(file => recorded[file.path] === file.fingerprint)
}

export async function archiveDeploymentBackups(directory: string, project: string, plan: BackupPlan, archives: Record<string, DeployArchive>, receipts: string): Promise<void> {
  if (!/^[a-z0-9_-]+$/i.test(project))
    throw new Error('Invalid deployment backup project name')
  const providers = Object.entries(archives)
  if (providers.length < 2 || !providers.some(([provider]) => provider === 'aws'))
    throw new Error('Deployment backup archival requires AWS and a second repository')

  const paths = plan.uploads.map(file => file.path)
  const checksums = new Map<string, string>()
  for (const file of plan.uploads) {
    const checksum = await digest(file.path)
    if (backupFile(file.path)?.fingerprint !== file.fingerprint)
      throw new Error(`Backup changed during hashing: ${file.path}`)
    checksums.set(file.path, checksum)
  }
  const snapshots = new Map<string, string>()
  for (const [provider, archive] of providers) {
    const stdout = await archive.run('backup', '--json', '--tag', appTag, '--tag', 'production', '--tag', `project:${project}`, '--', ...paths)
    const summary = stdout.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line))
      .find(record => record.message_type === 'summary')
    const snapshot: string | undefined = summary?.snapshot_id
    if (!snapshot)
      throw new Error(`${provider}: no completed backup snapshot`)
    const metadata: { paths?: string[] } = JSON.parse(await archive.run('cat', 'snapshot', snapshot))
    const saved = new Set(metadata.paths)
    if (saved.size !== paths.length || !paths.every(path => saved.has(path)))
      throw new Error(`${provider}: snapshot path verification failed`)
    snapshots.set(provider, snapshot)
  }

  mkdirSync(receipts, { recursive: true, mode: 0o700 })
  for (const file of plan.removals) {
    const checksum = checksums.get(file.path)
    if (!checksum)
      throw new Error('Refusing to remove a backup outside the upload plan')
    if (freeBytes(directory) < file.size + 512 * 1024 ** 2)
      throw new Error('Insufficient restore-check space. Local backups are retained.')
    await withScratch(join(directory, '.restore-check-'), async (scratch) => {
      writeFileSync(join(scratch, restoreMarker), restoreMarkerContent, { mode: 0o600 })
      const restored = join(scratch, 'restored')
      for (const [provider, archive] of providers) {
        await archive.restore(snapshots.get(provider)!, file.path, restored)
        if (lstatSync(restored).size !== file.size || await digest(restored) !== checksum)
          throw new Error(`${provider}: restore verification failed for ${file.path}`)
      }
    })
    if (backupFile(file.path)?.fingerprint !== file.fingerprint)
      throw new Error(`Backup changed during archival: ${file.path}`)
    appendReceipt(join(receipts, `${project}.jsonl`), {
      path: file.path,
      snapshot: snapshots.get('aws'),
      sha256: checksum,
      size: file.size,
      verified_at: Math.floor(Date.now() / 1000),
      replicas: Object.fromEntries(snapshots),
    })
    unlinkSync(file.path)
    console.log(`Verified off-host restores and removed local duplicate: ${file.path}`)
  }

  const manifest = plan.uploads.filter(file => backupFile(file.path)?.fingerprint === file.fingerprint)
  saveJson(join(receipts, `${project}.uploaded.json`), Object.fromEntries(manifest.map(file => [file.path, file.fingerprint])))
  console.log(`Archived ${project}: ${paths.length} deployment backups in ${providers.length} repositories`)
}
