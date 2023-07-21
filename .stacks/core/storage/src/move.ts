// import type { glob } from '@stacksjs/utils'
import type { Result } from '@stacksjs/error-handling'
import { err, ok } from '@stacksjs/error-handling'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from './fs'

interface MoveOptions {
  // glob?: glob.Options
  overwrite?: boolean
}

export async function move(src: string | string[], dest: string, options?: MoveOptions): Promise<Result<{ message: string }, Error>> {
  if (Array.isArray(src)) {
    src.forEach(async (file) => {
      const from = file
      const to = path.resolve(dest, path.basename(file))
      const result = await rename(from, to, options)

      if (result.isErr()) {
        log.error(result.error)
        return new Error(result.error.message, result.error)
      }
    })

    return ok({ message: 'File moved successfully' })
  }

  const from = src
  const to = dest
  const result = await rename(from, to, options)

  if (result.isErr()) {
    log.error(result.error)
    return err(new Error(result.error.message, result.error))
  }

  return ok({ message: 'File moved successfully' })
}

export async function rename(from: string, to: string, options?: MoveOptions): Promise<Result<{ message: string }, Error>> {
  try {
    // Check if the "to" directory exists
    const dir = path.dirname(to)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })

    // Ensure the "from" file exists
    if (!fs.existsSync(from))
      return err(new Error(`File or directory does not exist: ${from}`))

    // Ensure the "to" file does not exist
    if (fs.existsSync(to)) {
      if (options?.overwrite)
        fs.unlinkSync(to)
      else
        return err(new Error(`File or directory already exists: ${to}`))
    }

    // "Move" the file
    fs.renameSync(from, to)

    return ok({ message: 'File moved successfully' })
  }
  catch (error: any) {
    if (error.code === 'ENOENT')
      log.error('File or directory does not exist\n\n', error)
    else
      log.error(error)

    return err(new Error(error))
  }
}
