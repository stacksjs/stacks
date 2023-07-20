import { glob } from '@stacksjs/utils'
import { fs } from './fs'

interface MoveOptions {
  glob?: glob.Options
}

export async function move(src: string | string[], dest: string, options?: MoveOptions): Promise<void> {
  if (Array.isArray(src)) {
    src.forEach(async (file) => {
      console.log('checking', file)

      let fg

      if (file.includes('*')) {
        console.log('globbing', file)

        const pattern = file
        fg = await glob(pattern, options?.glob)
      }

      console.log('fg', fg)

      // rename(file, join(dest, basename(file)))
    })
  }
  else {
    // rename(src, join(dest, basename(src)))
  }
}

export async function rename(from: string, to: string): Promise<void> {
  fs.renameSync(from, to)
}
