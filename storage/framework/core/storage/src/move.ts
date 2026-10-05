import type { Result } from '@stacksjs/error-handling'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from './fs'

interface MoveOptions {
  // glob?: glob.Options
  overwrite?: boolean
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
        return err(handleError(errors[0]))

      return ok({ message: 'Files moved successfully' })
    }

    const from = src
    const to = dest
    const result = await rename(from, to, options)

    if (result.isErr) {
      log.error(result.error)
      return err(handleError(result.error))
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

    const dir = path.dirname(to)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })

    if (fs.existsSync(to) && !isSameEntry(from, to)) {
      if (!options?.overwrite)
        return err(new Error(`File or directory already exists: ${to}`))

      fs.rmSync(to, { recursive: true, force: true })
    }

    fs.renameSync(from, to)

    return ok({ message: 'File moved successfully' })
  }
  catch (error: any) {
    if (error?.code === 'ENOENT')
      log.error('File or directory does not exist\n\n', error)
    else log.error(error)

    return err(error instanceof Error ? error : new Error(String(error)))
  }
}

/** Whether two paths name one file: the same path, or another case of it. */
function isSameEntry(a: string, b: string): boolean {
  if (path.resolve(a) === path.resolve(b))
    return true
  try {
    const left = fs.statSync(a)
    const right = fs.statSync(b)
    return left.dev === right.dev && left.ino === right.ino
  }
  catch {
    return false
  }
}
