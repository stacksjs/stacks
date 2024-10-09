import * as fs from 'fs-extra'
import { pathExists as existsSync, watch as fsWatch, mkdirSync, readFileSync, watchFile, writeFileSync } from 'fs-extra'

export async function exists(path: string): Promise<boolean> {
  return await existsSync(path)
}

export { existsSync, fs, fsWatch, mkdirSync, readFileSync, watchFile, writeFileSync }
