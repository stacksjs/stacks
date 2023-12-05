import * as crypto from 'node:crypto'
import { path as p } from 'stacks:path'
import { fs } from './fs'

export function hashFileOrDirectory(path: string, hash: crypto.Hash): void {
  if (fs.default.statSync(path).isDirectory()) {
    const files = fs.default.readdirSync(path)
    for (const file of files) {
      const filePath = p.join(path, file)
      hashFileOrDirectory(filePath, hash)
    }
  }
  else {
    hash.update(fs.default.readFileSync(path))
  }
}

export function hashDirectory(directory: string): string {
  const hash = crypto.createHash('sha256')
  hashFileOrDirectory(directory, hash)
  return hash.digest('hex')
}

export function hashPath(path: string): string {
  const hash = crypto.createHash('sha256')
  hashFileOrDirectory(path, hash)
  return hash.digest('hex')
}

export function hashPaths(paths: string | string[]): string {
  const hash = crypto.createHash('sha256')
  const pathsArray = Array.isArray(paths) ? paths : [paths]

  for (const path of pathsArray)
    hashFileOrDirectory(path, hash)

  return hash.digest('hex')
}
