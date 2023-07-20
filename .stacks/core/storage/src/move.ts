// import type { glob } from '@stacksjs/utils'
import { ExitCode } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from './fs'

interface MoveOptions {
  // glob?: glob.Options
  overwrite?: boolean
}

export async function move(src: string | string[], dest: string, options?: MoveOptions): Promise<void> {
  if (Array.isArray(src)) {
    src.forEach(async (file) => {
      const from = file
      const to = path.resolve(dest, path.basename(file))
      rename(from, to, options)
    })
  }
  else {
    const from = src
    const to = dest
    rename(from, to, options)
  }
}

export async function rename(from: string, to: string, options?: MoveOptions): Promise<void> {
  try {
    // Check if the "to" directory exists
    const dir = path.dirname(to)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })

    // Ensure the "from" file exists
    if (!fs.existsSync(from))
      throw new Error(`File or directory does not exist: ${from}`)

    // Ensure the "to" file does not exist
    if (fs.existsSync(to)) {
      if (options?.overwrite)
        fs.unlinkSync(to)
      else
        throw new Error(`File or directory already exists: ${to}`)
    }

    // "Move" the file
    fs.renameSync(from, to)
  }
  catch (error: any) {
    if (error.code === 'ENOENT')
      log.error('File or directory does not exist\n\n', error)
    else
      log.error(error)

    process.exit(ExitCode.FatalError)
  }
}
