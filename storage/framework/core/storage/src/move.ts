import type { Result } from '@stacksjs/error-handling'
import { createHash } from 'node:crypto'
import { isAbsolute, relative, sep } from 'node:path'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from './fs'

interface MoveOptions {
  // glob?: glob.Options
  overwrite?: boolean
}

/** A preserved replacement needs inspection before this destination is reused. */
export class StorageRenameRecoveryError extends Error {
  readonly code = 'ERR_STORAGE_RENAME_RECOVERY'
  constructor(
    readonly source: string,
    readonly destination: string,
    readonly lock: string,
    readonly backup: string | undefined,
    readonly phase: 'lock' | 'rollback' | 'cleanup',
    readonly installed: boolean,
    cause: unknown,
    readonly recoveryError?: unknown,
  ) {
    super(`Storage rename ${phase} requires inspection at ${lock}${backup ? `; previous entry: ${backup}` : ''}`, { cause })
    this.name = 'StorageRenameRecoveryError'
  }
}

export async function move(
  src: string | string[],
  dest: string,
  options?: MoveOptions,
): Promise<Result<{ message: string }, Error>> {
  try {
    if (Array.isArray(src)) {
      const errors: Error[] = []
      const operations = src.map(async (file) => {
        const from = file
        const to = path.resolve(dest, path.basename(file))
        const result = await rename(from, to, options)

        if (result.isErr) {
          log.error(result.error)
          errors.push(result.error)
        }
      })

      await Promise.all(operations)

      if (errors.length > 0)
        return err(errors[0]!)

      return ok({ message: 'Files moved successfully' })
    }

    const from = src
    const to = dest
    const result = await rename(from, to, options)

    if (result.isErr) {
      log.error(result.error)
      return err(result.error)
    }

    return ok({ message: 'File moved successfully' })
  }
  catch (error: any) {
    return err(handleError(error))
  }
}

/**
 * Rename `from` to `to`, creating `to`'s directory.
 *
 * Every failure RESOLVES to an `Err`. They used to reject with one, so a
 * caller doing `const result = await rename(...); if (result.isErr)` - the
 * shape the return type promises, and the one `move()` itself uses - got an
 * exception instead, whose thrown value was a Result rather than an Error.
 *
 * Renaming a file onto itself is a no-op, or a change of case on a
 * case-insensitive disk. With `overwrite` it used to delete the destination
 * first, which was the source: the file was gone before the rename ran.
 * Overwrite now keeps native replacement where supported and restores a
 * directory backup after failed installation. Recovery errors preserve state
 * for inspection; the two-step directory path has no atomic visibility claim.
 */
export async function rename(
  from: string,
  to: string,
  options?: MoveOptions,
): Promise<Result<{ message: string }, Error>> {
  try {
    // Before anything is created: a missing source is the caller's mistake,
    // and should not leave a new directory behind.
    if (!fs.existsSync(from))
      return err(new Error(`File or directory does not exist: ${from}`))

    const source = canonicalEntry(from), destination = canonicalEntry(to)
    const sameEntry = source === destination || matches(identity(source), identity(destination))
    if (!sameEntry) {
      if (beneath(source, destination) || beneath(destination, source))
        return err(new Error('Source and destination must not overlap'))
    }

    const dir = path.dirname(to)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })

    if (canonicalEntry(from) !== source || canonicalEntry(to) !== destination)
      throw new Error('The source or destination parent changed')
    replaceEntry(source, destination, options?.overwrite === true)

    return ok({ message: 'File moved successfully' })
  }
  catch (error: any) {
    if (error?.code === 'ENOENT')
      log.error('File or directory does not exist\n\n', error)
    else log.error(error)

    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

interface Identity { device: bigint, inode: bigint, directory: boolean }
function identity(file: string): Identity | undefined {
  try {
    const stat = fs.lstatSync(file, { bigint: true })
    return { device: stat.dev, inode: stat.ino, directory: stat.isDirectory() }
  }
  catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
    throw error
  }
}
function matches(left: Identity | undefined, right: Identity | undefined): boolean {
  return left?.device === right?.device && left?.inode === right?.inode && left?.directory === right?.directory
}

/** A local, synchronous two-step replacement, serialized with cooperating callers. */
function replaceEntry(source: string, destination: string, overwrite: boolean): void {
  const parent = path.dirname(destination), sourceParent = path.dirname(source)
  const parentIdentity = identity(parent), sourceParentIdentity = identity(sourceParent), sourceIdentity = identity(source)
  // Conservative folding also serializes common case/Unicode aliases on local
  // case-insensitive filesystems. Distinct case-sensitive names may contend.
  const lock = path.join(parent, `.stacks-rename-${createHash('sha256').update(destination.normalize('NFC').toLowerCase()).digest('hex')}`)
  try { fs.mkdirSync(lock, { mode: 0o700 }) }
  catch (error) { throw new StorageRenameRecoveryError(source, destination, lock, undefined, 'lock', false, error) }
  const lockIdentity = identity(lock), backup = path.join(lock, 'previous'), journal = path.join(lock, 'operation.json')
  let moved = false, installed = false, previous: Identity | undefined
  const unchanged = (): void => {
    if (!matches(parentIdentity, identity(parent)) || !matches(sourceParentIdentity, identity(sourceParent)) || !matches(lockIdentity, identity(lock)))
      throw new Error('A storage rename parent or lock changed')
  }
  const unlock = (): void => {
    unchanged()
    if (identity(journal)) fs.unlinkSync(journal)
    fs.rmdirSync(lock)
  }
  try {
    unchanged()
    if (!sourceIdentity || !matches(sourceIdentity, identity(source))) throw new Error('The source entry changed')
    previous = identity(destination)
    const sameEntry = matches(sourceIdentity, previous)
    if (previous && !sameEntry && !overwrite) throw new Error(`File or directory already exists: ${destination}`)
    fs.writeFileSync(journal, `${JSON.stringify({ version: 1, source, destination, backup, sourceIdentity, previous }, (_, value) => typeof value === 'bigint' ? String(value) : value)}\n`, { flag: 'wx', mode: 0o600 })
    unchanged()
    if (!matches(previous, identity(destination))) throw new Error('The destination entry changed')
    // Let the OS replace files and empty directories directly. A refusal to
    // replace a directory/type is the only reason to use the two-step path.
    try {
      fs.renameSync(source, destination)
      installed = true
    }
    catch (nativeError) {
      const refusal = nativeError instanceof Error && 'code' in nativeError && ['ENOTEMPTY', 'EEXIST', 'EISDIR', 'ENOTDIR', 'EPERM'].includes(String(nativeError.code))
      if (!refusal || !previous || sameEntry || (!previous.directory && !sourceIdentity.directory)) throw nativeError
      unchanged()
      if (!matches(previous, identity(destination)) || !matches(sourceIdentity, identity(source)))
        throw new Error('A storage rename entry changed before replacement', { cause: nativeError })
      fs.renameSync(destination, backup)
      moved = true
      unchanged()
      if (!matches(previous, identity(backup)) || identity(destination) || !matches(sourceIdentity, identity(source)))
        throw new Error('A storage rename entry changed before installation')
      fs.renameSync(source, destination)
      installed = true
    }
  }
  catch (error) {
    if (moved) {
      try {
        unchanged()
        if (identity(destination) || !matches(previous, identity(backup))) throw new Error('Cannot restore over changed replacement entries')
        fs.renameSync(backup, destination)
      }
      catch (recoveryError) { throw new StorageRenameRecoveryError(source, destination, lock, backup, 'rollback', false, error, recoveryError) }
    }
    try { unlock() }
    catch (recoveryError) { throw new StorageRenameRecoveryError(source, destination, lock, undefined, 'cleanup', false, error, recoveryError) }
    throw error
  }
  try {
    unchanged()
    if (!matches(sourceIdentity, identity(destination))) throw new Error('The installed destination entry changed')
    if (moved) {
      if (!matches(previous, identity(backup))) throw new Error('The previous destination entry changed')
      fs.rmSync(backup, { recursive: true })
    }
    unlock()
  }
  catch (error) { throw new StorageRenameRecoveryError(source, destination, lock, moved ? backup : undefined, 'cleanup', installed, error) }
}

/** Resolve existing parent aliases without following the entry being renamed. */
function canonicalEntry(file: string): string {
  const absolute = path.resolve(file)
  let parent = path.dirname(absolute)
  const pending: string[] = []
  while (!fs.existsSync(parent)) {
    pending.unshift(path.basename(parent))
    const next = path.dirname(parent)
    if (next === parent) throw new Error(`Cannot resolve the parent of ${file}`)
    parent = next
  }
  return path.join(fs.realpathSync(parent), ...pending, path.basename(absolute))
}

function beneath(child: string, parent: string): boolean {
  const route = relative(parent, child)
  return route !== '' && route !== '..' && !route.startsWith(`..${sep}`) && !isAbsolute(route)
}
