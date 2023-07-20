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
