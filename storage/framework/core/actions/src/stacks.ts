import type { ConflictStrategy, StackDirectory, StackInstallOptions, StackListEntry, StackLock, StackManifestEntry, StackMeta, StackUninstallOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { dirname, join, projectPath, relative, stacksBackupPath, stacksLockPath } from '@stacksjs/path'
import { copyFile, createFolder, deleteFile, deleteEmptyFolders, doesFolderExist, fs } from '@stacksjs/storage'

const STACK_DIRS: StackDirectory[] = ['app', 'config', 'database', 'resources', 'routes', 'public', 'locales']

async function readStackLock(): Promise<StackLock> {
  const lockPath = stacksLockPath()

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

async function writeStackLock(lock: StackLock): Promise<void> {
  const lockPath = stacksLockPath()
  const lockDir = dirname(lockPath)

  if (!fs.existsSync(lockDir))
    await createFolder(lockDir)

  lock.generatedAt = new Date().toISOString()
  await Bun.write(lockPath, JSON.stringify(lock, null, 2))
}

function resolveStackPackagePath(name: string): string | null {
  const pantryDir = projectPath('pantry')

  // Try direct name: pantry/{name}
  const directPath = join(pantryDir, name)
  if (fs.existsSync(join(directPath, 'package.json')))
    return directPath

  // Try scoped: pantry/@stacksjs/{name}
  const scopedPath = join(pantryDir, '@stacksjs', name)
  if (fs.existsSync(join(scopedPath, 'package.json')))
    return scopedPath

  // Try as a full scoped package name: pantry/@scope/name
  if (name.startsWith('@')) {
    const fullPath = join(pantryDir, name)
    if (fs.existsSync(join(fullPath, 'package.json')))
      return fullPath
  }

  // Scan pantry for any package whose stacks.name matches
  const patterns = ['*/package.json', '@*/*/package.json']
  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern)
    for (const file of glob.scanSync({ cwd: pantryDir, absolute: true, onlyFiles: true })) {
      try {
        const pkg = JSON.parse(fs.readFileSync(file, 'utf-8'))
        if (pkg?.stacks?.name === name)
          return dirname(file)
      }
      catch {
        // Skip unreadable files
      }
    }
  }

  return null
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
    else {
      files.push(relative(baseDir, fullPath))
    }
  }

  return files
}

export async function installStack(options: StackInstallOptions): Promise<StackManifestEntry | null> {
  const { name, force = false, dryRun = false, verbose = false } = options
  const conflict: ConflictStrategy = force ? 'overwrite' : (options.conflict ?? 'skip')

  log.info(`Installing stack "${name}"...`)

  // Resolve the stack package location
  const stackPath = resolveStackPackagePath(name)
  if (!stackPath) {
    log.error(`Stack "${name}" not found in pantry. Install it first with: bun add <package-name>`)
    return null
  }

  // Read stack metadata
  let pkg: any
  let meta: StackMeta
  try {
    const pkgContent = await Bun.file(join(stackPath, 'package.json')).text()
    pkg = JSON.parse(pkgContent)
    meta = pkg.stacks as StackMeta

    if (!meta?.name) {
      log.error(`Package at "${stackPath}" does not have a valid "stacks" field in package.json`)
      return null
    }
  }
  catch (error) {
    log.error(`Failed to read stack package.json: ${error}`)
    return null
  }

  // Check if already installed
  const lock = await readStackLock()
  const packageName = pkg.name || name
  if (lock.stacks[packageName] && !force) {
    log.warn(`Stack "${meta.name}" is already installed. Use --force to reinstall.`)
    return lock.stacks[packageName]
  }

  // Determine which directories to scan
  const dirsToScan = meta.directories ?? STACK_DIRS

  // Collect all files from the stack
  const allFiles: string[] = []
  for (const dir of dirsToScan) {
    const dirPath = join(stackPath, dir)
    if (fs.existsSync(dirPath)) {
      const files = collectFiles(dirPath, stackPath)
      allFiles.push(...files)
    }
  }

  if (allFiles.length === 0) {
    log.warn(`Stack "${meta.name}" has no files to install`)
    return null
  }

  if (verbose)
    log.info(`Found ${allFiles.length} file(s) to install`)

  const copiedFiles: string[] = []
  const skippedFiles: string[] = []

  for (const relPath of allFiles) {
    const src = join(stackPath, relPath)
    const dest = projectPath(relPath)

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

    // Handle conflicts
    if (fs.existsSync(dest)) {
      switch (conflict) {
        case 'skip':
          if (verbose)
            log.warn(`Skipping (file exists): ${relPath}`)
          skippedFiles.push(relPath)
          continue

        case 'backup': {
          const backupDir = stacksBackupPath(meta.name)
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

    // Copy the file
    const destDir = dirname(dest)
    if (!fs.existsSync(destDir))
      await createFolder(destDir)

    copyFile(src, dest)
    copiedFiles.push(relPath)

    if (verbose)
      log.info(`Copied: ${relPath}`)
  }

  if (dryRun) {
    log.info(`[dry-run] Would install ${copiedFiles.length} file(s), skip ${skippedFiles.length} file(s)`)
    return null
  }

  // Create manifest entry
  const entry: StackManifestEntry = {
    packageName,
    name: meta.name,
    version: pkg.version || '0.0.0',
    installedAt: new Date().toISOString(),
    files: copiedFiles,
    skipped: skippedFiles,
    conflictStrategy: conflict,
  }

  // Update lock file
  lock.stacks[packageName] = entry
  await writeStackLock(lock)

  log.success(`Installed stack "${meta.name}" (${copiedFiles.length} file(s) copied, ${skippedFiles.length} skipped)`)
  return entry
}

export async function uninstallStack(options: StackUninstallOptions): Promise<boolean> {
  const { name, force = false, verbose = false } = options

  log.info(`Uninstalling stack "${name}"...`)

  const lock = await readStackLock()

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

  // Delete each file that was installed by this stack
  for (const relPath of entry.files) {
    const filePath = projectPath(relPath)

    if (!fs.existsSync(filePath)) {
      if (verbose)
        log.info(`Already removed: ${relPath}`)
      continue
    }

    if (!force) {
      // Check if file has been modified by comparing with stack source
      const stackPath = resolveStackPackagePath(name)
      if (stackPath) {
        const srcPath = join(stackPath, relPath)
        if (fs.existsSync(srcPath)) {
          const srcContent = await Bun.file(srcPath).text()
          const destContent = await Bun.file(filePath).text()
          if (srcContent !== destContent) {
            log.warn(`Skipping modified file: ${relPath} (use --force to remove)`)
            continue
          }
        }
      }
    }

    await deleteFile(filePath)
    removedCount++

    if (verbose)
      log.info(`Removed: ${relPath}`)
  }

  // Restore backups if they exist
  const backupDir = stacksBackupPath(entry.name)
  if (fs.existsSync(backupDir) && doesFolderExist(backupDir)) {
    const backupFiles = collectFiles(backupDir, backupDir)
    for (const relPath of backupFiles) {
      const backupSrc = join(backupDir, relPath)
      const dest = projectPath(relPath)
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
    const dirPath = projectPath(dir)
    if (fs.existsSync(dirPath))
      await deleteEmptyFolders(dirPath)
  }

  // Remove from lock file
  delete lock.stacks[entryKey]
  await writeStackLock(lock)

  log.success(`Uninstalled stack "${entry.name}" (${removedCount} file(s) removed)`)
  return true
}

export async function listStacks(): Promise<StackListEntry[]> {
  const entries: StackListEntry[] = []
  const lock = await readStackLock()

  // Scan pantry for available stacks
  const pantryDir = projectPath('pantry')
  if (fs.existsSync(pantryDir)) {
    const patterns = ['*/package.json', '@*/*/package.json']
    for (const pattern of patterns) {
      const glob = new Bun.Glob(pattern)
      for (const file of glob.scanSync({ cwd: pantryDir, absolute: true, onlyFiles: true })) {
        try {
          const pkgContent = fs.readFileSync(file, 'utf-8')
          const pkg = JSON.parse(pkgContent)

          if (!pkg?.stacks?.name)
            continue

          const packageName = pkg.name
          const installed = !!lock.stacks[packageName]
          const lockEntry = lock.stacks[packageName]

          entries.push({
            name: pkg.stacks.name,
            packageName,
            version: pkg.version || '0.0.0',
            description: pkg.stacks.description,
            installed,
            installedAt: lockEntry?.installedAt,
            fileCount: lockEntry?.files.length,
          })
        }
        catch {
          // Skip unreadable files
        }
      }
    }
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
