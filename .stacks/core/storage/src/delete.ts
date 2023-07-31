import { italic, log } from '@stacksjs/cli'
import { glob } from './glob'
import { fs } from './fs'

export async function deleteFolder(path: string) {
  if (fs.statSync(path).isDirectory())
    await fs.rmSync(path, { recursive: true, force: true })
}

export function deleteEmptyFolders(dir: string) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach((file) => {
      const p = join(dir, file)
      if (fs.statSync(p).isDirectory()) {
        if (fs.readdirSync(p).length === 0)
          fs.rmSync(p, { recursive: true, force: true })

        else deleteEmptyFolders(p)
      }
    })
  }
}

// TODO: ensure this also works for files
export async function del(path: string) {
  if (path.includes('*')) {
    const directories = await glob([path], { onlyDirectories: true })

    for (const directory of directories) {
      await deleteFolder(directory)
      log.info(`Deleted ${italic(directory)}`)
    }
  }
  else {
    await deleteFolder(path)
    log.info(`Deleted ${italic(path)}`)
  }
}
