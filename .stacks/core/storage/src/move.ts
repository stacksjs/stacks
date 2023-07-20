// import type { glob } from '@stacksjs/utils'
import { ExitCode } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { fs } from './fs'

// interface MoveOptions {
//   glob?: glob.Options
// }

export async function move(src: string | string[], dest: string): Promise<void> {
  if (Array.isArray(src)) {
    src.forEach(async (file) => {
      const from = file
      const to = path.resolve(dest, path.basename(file))
      rename(from, to)
    })
  }
  else {
    const from = src
    const to = dest
    rename(from, to)
  }
}

export async function rename(from: string, to: string): Promise<void> {
  try {
    // Check if the "to" directory exists
    const dir = path.dirname(to)
    if (!fs.existsSync(dir))
      fs.mkdirSync(dir, { recursive: true })

    fs.renameSync(from, to)
  }
  catch (error) {
    if (error.code === 'ENOENT')
      log.error('File or directory does not exist\n\n', error)
    else
      log.error(error)

    process.exit(ExitCode.FatalError)
  }
}
