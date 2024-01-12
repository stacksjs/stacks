import { mkdirSync, writeFileSync } from 'node:fs'
import * as fs from 'fs-extra'
import { pathExists as existsSync } from 'fs-extra'

export async function exists(path: string): Promise<boolean> {
  return await existsSync(path)
}

export { fs, existsSync, mkdirSync, writeFileSync }