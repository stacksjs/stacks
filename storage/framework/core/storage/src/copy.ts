import { contains } from '@stacksjs/arrays'
import { join } from '@stacksjs/path'
import { fs } from './fs'

export function copy(src: string | string[], dest: string, exclude: string[] = []): void {
  if (Array.isArray(src)) {
    src.forEach((file) => {
      copy(file, dest, exclude)
    })
  }
  else {
    if (fs.statSync(src).isDirectory())
      copyFolder(src, dest, exclude)
    else copyFile(src, dest)
  }
}

export function copyFile(src: string, dest: string): void {
  fs.copyFileSync(src, dest)
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
        else fs.copyFileSync(srcPath, destPath)
      }
    })
  }
}
