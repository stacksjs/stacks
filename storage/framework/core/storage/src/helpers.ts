import { fileURLToPath } from 'node:url'
import { dirname } from '@stacksjs/path'
import { fs } from './fs'

export const _dirname: string = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))

export function updateConfigFile(filePath: string, newConfig: Record<string, unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    let config: Record<string, unknown>
    try {
      config = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>
    }
    catch (error) {
      reject(new Error(`Failed to parse config file "${filePath}": ${(error as Error).message}`))
      return
    }

    for (const key in newConfig) config[key] = newConfig[key]

    try {
      fs.writeFileSync(filePath, JSON.stringify(config, null, 2))
      resolve()
    }
    catch (error) {
      reject(error)
    }
  })
}

interface Helpers {
  _dirname: string
  updateConfigFile: (filePath: string, newConfig: Record<string, unknown>) => Promise<void>
}

export const helpers: Helpers = {
  _dirname,
  updateConfigFile,
}
