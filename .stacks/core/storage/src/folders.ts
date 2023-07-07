import fs from 'fs-extra'
import { contains } from '@stacksjs/arrays'
import { join } from '@stacksjs/path'

/**
 * Determine whether a path is a folder.
 */
export function isFolder(path: string): boolean {
  try {
    return fs.statSync(path).isDirectory()
  }
  catch {
    return false
  }
}

export function copyFolder(src: string, dest: string, exclude: string[] = []): void {
  if (!fs.existsSync(dest))
    fs.mkdirSync(dest, { recursive: true })

  if (fs.existsSync(src)) {
    fs.readdirSync(src).forEach((file) => {
      if (!contains(join(src, file), exclude)) {
        const srcPath = join(src, file)
        const destPath = join(dest, file)

        if (fs.statSync(srcPath).isDirectory())
          copyFolder(srcPath, destPath, exclude)

        else
          fs.copyFileSync(srcPath, destPath)
      }
    })
  }
}

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

export function doesFolderExist(path: string) {
  return fs.existsSync(path)
}

export function createFolder(dir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdirs(dir, (err: any) => {
      if (err)
        reject(err)

      else
        resolve()
    })
  })
}

export function getFolders(dir: string): string[] {
  return fs.readdirSync(dir).filter((file) => {
    return fs.statSync(join(dir, file)).isDirectory()
  })
}
