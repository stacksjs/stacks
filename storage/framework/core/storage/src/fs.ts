import * as fs from 'fs-extra'
import { pathExists as existsSync, mkdirSync, readFileSync, watch, watchFile, writeFileSync } from 'fs-extra'

export async function exists(path: string): Promise<boolean> {
  return await existsSync(path)
}

export { fs, existsSync, mkdirSync, writeFileSync, readFileSync, watch, watchFile }
