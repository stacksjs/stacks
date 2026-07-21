import type { ConflictStrategy, StackDirectory, StackInstallOptions, StackListEntry, StackLock, StackManifestEntry, StackMeta, StackUninstallOptions } from '@stacksjs/types'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { log } from '@stacksjs/logging'
import { registry } from '@stacksjs/registry'
import { copyFile, createFolder, deleteFile, deleteEmptyFolders, doesFolderExist, fs } from '@stacksjs/storage'

const STACK_DIRS: StackDirectory[] = ['app', 'config', 'database', 'resources', 'routes', 'public', 'locales', 'docs']

function stackLockPath(projectRoot: string): string {
  return join(projectRoot, 'storage', 'framework', 'stacks.lock.json')
}

function stackBackupPath(projectRoot: string, stackName: string): string {
  return join(projectRoot, 'storage', 'framework', 'stacks', 'backups', stackName)
}

async function readStackLock(projectRoot: string): Promise<StackLock> {
  const lockPath = stackLockPath(projectRoot)

  try {
    if (fs.existsSync(lockPath)) {
      const content = await Bun.file(lockPath).text()
      return JSON.parse(content) as StackLock
    }
  }
  catch {
    // Lock file doesn't exist or is corrupt, start fresh
  }

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    stacks: {},
  }
}

async function writeStackLock(projectRoot: string, lock: StackLock): Promise<void> {
  const lockPath = stackLockPath(projectRoot)
  const lockDir = dirname(lockPath)

  if (!fs.existsSync(lockDir))
    await createFolder(lockDir)

  lock.generatedAt = new Date().toISOString()
  await Bun.write(lockPath, JSON.stringify(lock, null, 2))
}

function resolveProjectRoot(project?: string): string {
  return resolve(project || process.cwd())
}

function resolveRegistryEntry(name: string): { name: string, github: string, package?: string } | null {
  const entry = registry.find((candidate) => {
    if (typeof candidate === 'string')
      return candidate === name

    return candidate.name === name || candidate.package === name
  })

  if (!entry || typeof entry === 'string')
    return null

  if (!entry.github)
    return null

  return { name: entry.name, github: entry.github, package: entry.package }
}

async function checkoutRegistryStack(github: string): Promise<{ path: string, cleanup: () => void }> {
  const tempRoot = mkdtempSync(join(tmpdir(), 'stacks-stack-'))
  const checkoutPath = join(tempRoot, 'source')
  const source = `https://github.com/${github}.git`
  const child = Bun.spawn(['git', 'clone', '--depth', '1', '--quiet', source, checkoutPath], {
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await child.exited

  if (exitCode !== 0) {
    rmSync(tempRoot, { recursive: true, force: true })
    throw new Error(`Could not pull ${source}`)
  }

  return {
    path: checkoutPath,
    cleanup: () => rmSync(tempRoot, { recursive: true, force: true }),
  }
}

function isSafeStackDirectory(directory: string): boolean {
  return directory.length > 0
    && !isAbsolute(directory)
    && !directory.includes('..')
    && !directory.includes('\\')
}

function fileChecksum(path: string): string {
  return new Bun.CryptoHasher('sha256').update(fs.readFileSync(path)).digest('hex')
}

function collectFiles(dir: string, baseDir: string): string[] {
  const files: string[] = []

  if (!fs.existsSync(dir))
    return files

  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir))
    }
    else if (entry.isSymbolicLink()) {
      throw new Error(`Stack contains an unsupported symbolic link: ${relative(baseDir, fullPath)}`)
    }
    else {
      const relPath = relative(baseDir, fullPath)
      if (!isSafeStackDirectory(relPath))
        throw new Error(`Stack contains an unsafe path: ${relPath}`)
      files.push(relPath)
    }
  }

  return files
}

export async function installStack(options: StackInstallOptions): Promise<StackManifestEntry | null> {
  const { name, force = false, dryRun = false, verbose = false } = options
  const conflict: ConflictStrategy = force ? 'overwrite' : (options.conflict ?? 'skip')
  const projectRoot = resolveProjectRoot(options.project)

  log.info(`Installing stack "${name}"...`)

  if (!fs.existsSync(join(projectRoot, 'package.json'))) {
    log.error(`No Stacks project found at "${projectRoot}"`)
    return null
  }

  const registryEntry = resolveRegistryEntry(name)
  if (!registryEntry) {
    log.error(`Stack "${name}" is not in the Stacks registry. Run "buddy stack:list" to see available stacks.`)
    return null
  }

  let checkout: Awaited<ReturnType<typeof checkoutRegistryStack>>
  try {
    checkout = await checkoutRegistryStack(registryEntry.github)
  }
  catch (error) {
    log.error(error instanceof Error ? error.message : String(error))
    return null
  }

  try {
    const stackPath = checkout.path
    let pkg: any
    let meta: StackMeta
    try {
      const pkgContent = await Bun.file(join(stackPath, 'package.json')).text()
      pkg = JSON.parse(pkgContent)
      meta = pkg.stacks as StackMeta

      if (!meta?.name || meta.name !== registryEntry.name) {
        log.error(`Registry source "${registryEntry.github}" does not declare stacks.name as "${registryEntry.name}"`)
        return null
      }
    }
    catch (error) {
      log.error(`Failed to read stack metadata: ${error}`)
      return null
    }

    const lock = await readStackLock(projectRoot)
    const packageName = pkg.name || registryEntry.package || name
    if (lock.stacks[packageName] && !force) {
      log.warn(`Stack "${meta.name}" is already installed. Use --force to reinstall.`)
      return lock.stacks[packageName]
    }

    const dirsToScan = meta.directories ?? STACK_DIRS
    if (dirsToScan.some(directory => !isSafeStackDirectory(directory))) {
      log.error(`Stack "${meta.name}" declares an unsafe project directory`)
      return null
    }

    const allFiles: string[] = []
    try {
      for (const dir of dirsToScan) {
        const dirPath = join(stackPath, dir)
        if (fs.existsSync(dirPath))
          allFiles.push(...collectFiles(dirPath, stackPath))
      }
    }
    catch (error) {
      log.error(error instanceof Error ? error.message : String(error))
      return null
    }

    if (allFiles.length === 0) {
      log.warn(`Stack "${meta.name}" has no project files to install`)
      return null
    }

    if (verbose)
      log.info(`Pulled ${registryEntry.github} and found ${allFiles.length} project file(s)`)

    const copiedFiles: string[] = []
    const skippedFiles: string[] = []
    const checksums: Record<string, string> = {}

    for (const relPath of allFiles) {
      const src = join(stackPath, relPath)
      const dest = join(projectRoot, relPath)

      if (dryRun) {
        if (fs.existsSync(dest)) {
          log.info(`[dry-run] Would ${conflict}: ${relPath}`)
          if (conflict === 'skip')
            skippedFiles.push(relPath)
          else
            copiedFiles.push(relPath)
        }
        else {
          log.info(`[dry-run] Would copy: ${relPath}`)
          copiedFiles.push(relPath)
        }
        continue
      }

      if (fs.existsSync(dest)) {
        switch (conflict) {
          case 'skip':
            if (verbose)
              log.warn(`Skipping (file exists): ${relPath}`)
            skippedFiles.push(relPath)
            continue

          case 'backup': {
            const backupDir = stackBackupPath(projectRoot, meta.name)
            const backupDest = join(backupDir, relPath)
            const backupDestDir = dirname(backupDest)
            if (!fs.existsSync(backupDestDir))
              await createFolder(backupDestDir)
            copyFile(dest, backupDest)
            if (verbose)
              log.info(`Backed up: ${relPath}`)
            break
          }

          case 'overwrite':
            if (verbose)
              log.warn(`Overwriting: ${relPath}`)
            break
        }
      }

      const destDir = dirname(dest)
      if (!fs.existsSync(destDir))
        await createFolder(destDir)

      copyFile(src, dest)
      copiedFiles.push(relPath)
      checksums[relPath] = fileChecksum(dest)

      if (verbose)
        log.info(`Copied: ${relPath}`)
    }

    const entry: StackManifestEntry = {
      packageName,
      name: meta.name,
      version: pkg.version || '0.0.0',
      installedAt: new Date().toISOString(),
      files: copiedFiles,
      checksums,
      source: registryEntry.github,
      skipped: skippedFiles,
      conflictStrategy: conflict,
    }

    if (dryRun) {
      log.info(`[dry-run] Would install ${copiedFiles.length} file(s), skip ${skippedFiles.length} file(s)`)
      return entry
    }

    lock.stacks[packageName] = entry
    await writeStackLock(projectRoot, lock)

    log.success(`Installed stack "${meta.name}" from ${registryEntry.github} (${copiedFiles.length} file(s) copied, ${skippedFiles.length} skipped)`)
    return entry
  }
  finally {
    checkout.cleanup()
  }
}

export async function uninstallStack(options: StackUninstallOptions): Promise<boolean> {
  const { name, force = false, verbose = false } = options
  const projectRoot = resolveProjectRoot(options.project)

  log.info(`Uninstalling stack "${name}"...`)

  const lock = await readStackLock(projectRoot)

  // Find the stack entry by name or package name
  let entryKey: string | null = null
  let entry: StackManifestEntry | null = null

  for (const [key, value] of Object.entries(lock.stacks)) {
    if (value.name === name || key === name) {
      entryKey = key
      entry = value
      break
    }
  }

  if (!entry || !entryKey) {
    log.error(`Stack "${name}" is not installed`)
    return false
  }

  let removedCount = 0
  const remainingFiles: string[] = []

  // Delete each file that was installed by this stack
  for (const relPath of entry.files) {
    const filePath = join(projectRoot, relPath)

    if (!fs.existsSync(filePath)) {
      if (verbose)
        log.info(`Already removed: ${relPath}`)
      continue
    }

    if (!force) {
      const installedChecksum = entry.checksums?.[relPath]
      if (!installedChecksum || fileChecksum(filePath) !== installedChecksum) {
        log.warn(`Skipping modified file: ${relPath} (use --force to remove)`)
        remainingFiles.push(relPath)
        continue
      }
    }

    await deleteFile(filePath)
    removedCount++

    if (verbose)
      log.info(`Removed: ${relPath}`)
  }

  if (remainingFiles.length > 0) {
    entry.files = remainingFiles
    entry.checksums = Object.fromEntries(
      remainingFiles
        .map(file => [file, entry.checksums?.[file]])
        .filter((item): item is [string, string] => typeof item[1] === 'string'),
    )
    lock.stacks[entryKey] = entry
    await writeStackLock(projectRoot, lock)
    log.warn(`Stack "${entry.name}" is still tracked because ${remainingFiles.length} modified file(s) remain`)
    return false
  }

  // Restore backups if they exist
  const backupDir = stackBackupPath(projectRoot, entry.name)
  if (fs.existsSync(backupDir) && doesFolderExist(backupDir)) {
    const backupFiles = collectFiles(backupDir, backupDir)
    for (const relPath of backupFiles) {
      const backupSrc = join(backupDir, relPath)
      const dest = join(projectRoot, relPath)
      const destDir = dirname(dest)

      if (!fs.existsSync(destDir))
        await createFolder(destDir)

      copyFile(backupSrc, dest)

      if (verbose)
        log.info(`Restored from backup: ${relPath}`)
    }

    // Clean up backup directory
    fs.rmSync(backupDir, { recursive: true, force: true })
  }

  // Clean up empty directories
  for (const dir of STACK_DIRS) {
    const dirPath = join(projectRoot, dir)
    if (fs.existsSync(dirPath))
      await deleteEmptyFolders(dirPath)
  }

  // Remove from lock file
  delete lock.stacks[entryKey]
  await writeStackLock(projectRoot, lock)

  log.success(`Uninstalled stack "${entry.name}" (${removedCount} file(s) removed)`)
  return true
}

export async function listStacks(project?: string): Promise<StackListEntry[]> {
  const entries: StackListEntry[] = []
  const projectRoot = resolveProjectRoot(project)
  const lock = await readStackLock(projectRoot)

  for (const candidate of registry) {
    if (typeof candidate === 'string')
      continue

    const packageName = candidate.package || candidate.name
    const lockEntry = lock.stacks[packageName]
    entries.push({
      name: candidate.name,
      packageName,
      version: lockEntry?.version || 'latest',
      description: candidate.description,
      installed: Boolean(lockEntry),
      installedAt: lockEntry?.installedAt,
      fileCount: lockEntry?.files.length,
    })
  }

  // Also include installed stacks that might not be in pantry anymore
  for (const [packageName, entry] of Object.entries(lock.stacks)) {
    if (!entries.some(e => e.packageName === packageName)) {
      entries.push({
        name: entry.name,
        packageName,
        version: entry.version,
        installed: true,
        installedAt: entry.installedAt,
        fileCount: entry.files.length,
      })
    }
  }

  return entries
}
