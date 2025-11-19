import * as fs from 'node:fs'
import { existsSync, watch as fsWatch, mkdirSync, readFileSync, watchFile, writeFileSync } from 'node:fs'

export function exists(path: string): boolean {
  return existsSync(path)
}

export { existsSync, fsWatch, mkdirSync, readFileSync, watchFile, writeFileSync, fs }
