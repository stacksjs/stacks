import type { Hash } from 'node:crypto'
import { createHash } from 'node:crypto'
import { path as p } from '@stacksjs/path'
import { fs } from './fs'

export function hashFileOrDirectory(path: string, hash: Hash): void {
  // Check if the path exists before proceeding
  if (!fs.existsSync(path)) {
    console.error(`Path does not exist: ${path}`)
    // Handle the non-existent path as needed (e.g., skip or log)
    return
  }

  if (fs.statSync(path).isDirectory()) {
    const files = fs.readdirSync(path)
    for (const file of files) {
      const filePath = p.join(path, file)
      hashFileOrDirectory(filePath, hash)
    }
  }
  else {
    hash.update(fs.readFileSync(path))
  }
}

export function hashDirectory(directory: string): string {
  const hash = createHash('sha256')
  hashFileOrDirectory(directory, hash)
  return hash.digest('hex')
}

export function hashPath(path: string): string {
  const hash = createHash('sha256')
  hashFileOrDirectory(path, hash)
  return hash.digest('hex')
}

export function hashPaths(paths: string | string[]): string {
  const hash = createHash('sha256')
  const pathsArray = Array.isArray(paths) ? paths : [paths]

  for (const path of pathsArray) hashFileOrDirectory(path, hash)

  return hash.digest('hex')
}
