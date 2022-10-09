import ezSpawn from '@jsdevtools/ez-spawn'
import { resolve } from 'pathe'
import { isFile, readTextFile } from '../utils/fs'

export async function isInitialized(path: string) {
  if (isFile('.env'))
    return await checkIfAppKeyIsSet(path)

  if (isFile('.env.example')) {
    await ezSpawn.async('cp .env.example .env', { stdio: 'inherit', cwd: path })
    return await checkIfAppKeyIsSet(path)
  }

  return await checkIfAppKeyIsSet(path)
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

export function libraryEntryPath(type: 'vue-components' | 'web-components' | 'functions') {
  const path = process.cwd()

  if (path.includes('.stacks'))
    return resolve(path, `core/build/entries/${type}.ts`)

  return resolve(path, `./.stacks/core/build/entries/${type}.ts`)
}

export function customElementsDataPath() {
  const path = process.cwd()

  if (path.includes('.stacks'))
    return resolve(path, 'custom-elements.json')

  return resolve(path, './.stacks/custom-elements.json')
}

export function componentsPath() {
  const path = process.cwd()

  if (path.includes('.stacks'))
    return resolve(path, '../components')

  return resolve(path, './components')
}

export function functionsPath() {
  const path = process.cwd()

  if (path.includes('.stacks'))
    return resolve(path, '../functions')

  return resolve(path, './functions')
}
