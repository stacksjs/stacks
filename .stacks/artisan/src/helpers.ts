import ezSpawn from '@jsdevtools/ez-spawn'
import { reset } from '../../../config/ui'
import { isFile, readTextFile } from '../../core/utils/fs'
import type { Manifest } from '../../core/types'

export async function isInitialized(path: string) {
  if (isFile('.env'))
    return await checkIfAppKeyIsSet(path)

  if (isFile('.env.example')) {
    await ezSpawn.async('cp .env.example .env', { stdio: 'inherit', cwd: path })
    return await checkIfAppKeyIsSet(path)
  }

  return false
}

export async function checkIfAppKeyIsSet(path?: string) {
  if (!path)
    path = process.cwd()

  const env = await readTextFile('.env', path)
  const lines = env.data.split('\n')
  const appKey = lines.find(line => line.startsWith('APP_KEY='))

  if (appKey && appKey.length > 16)
    return true

  return false
}

/**
 * @url https://www.npmjs.com/package/@unocss/reset
 * @param preset
 */
export function determineResetPreset(preset?: string) {
  if (reset)
    preset = reset

  if (preset === 'tailwind')
    return ['import \'@unocss/reset/tailwind.css\'']
  else if (preset === 'normalize')
    return ['import \'@unocss/reset/normalize.css\'']
  else if (preset === 'sanitize')
    return ['import \'@unocss/reset/sanitize/sanitize.css\'', 'import \'@unocss/reset/sanitize/assets.css']
  else if (preset === 'eric-meyer')
    return ['import \'@unocss/reset/eric-meyer.css\'']
  else if (preset === 'antfu')
    return ['import \'@unocss/reset/antfu.css\'']
  else return []
}

/**
 * Determines whether the specified value is a package manifest.
 */
export function isManifest(obj: any): obj is Manifest {
  return obj
    && typeof obj === 'object'
    && isOptionalString(obj.name)
    && isOptionalString(obj.version)
    && isOptionalString(obj.description)
}

/**
 * Determines whether the specified value is a string, null, or undefined.
 */
function isOptionalString(value: any): value is string | undefined {
  const type = typeof value
  return value === null
    || type === 'undefined'
    || type === 'string'
}
