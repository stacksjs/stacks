import ezSpawn from '@jsdevtools/ez-spawn'
import { resolve } from 'pathe'
// import * as configArr from '../core/config'
import { isFile, readTextFile } from './utils/fs'

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
  return resolve(buildEntriesPath(), `./${type}.ts`)
}

export function buildEntriesPath(path?: string) {
  return resolve(frameworkPath(), `./core/build/entries/${path || ''}`)
}

export function customElementsDataPath() {
  return resolve(frameworkPath(), './custom-elements.json')
}

export function componentsPath(path?: string) {
  return resolve(projectPath(), `./components/${path || ''}`)
}

export function pagesPath(path?: string) {
  return resolve(projectPath(), `./pages/${path || ''}`)
}

export function functionsPath(path?: string) {
  return resolve(projectPath(), `./functions/${path || ''}`)
}

export function configPath(path?: string) {
  return resolve(projectPath(), `./config/${path || ''}`)
}

export function routesPath(path?: string) {
  return resolve(projectPath(), `./routes/${path || ''}`)
}

export function langPath(path?: string) {
  return resolve(projectPath(), `./lang/${path || ''}`)
}

export function frameworkPath(path?: string) {
  return resolve(projectPath(), `./.stacks/${path || ''}`)
}

export function projectPath() {
  const path = process.cwd()

  if (path.includes('.stacks'))
    return resolve(path, '..')

  return resolve(path, '.')
}

export function packageJsonPath(type: 'vue-components' | 'web-components' | 'functions') {
  return resolve(frameworkPath(), `./${type}/package.json`)
}

export function env(key?: string, fallback?: string) {
  // eslint-disable-next-line no-console
  console.log('key', key, 'fallback', fallback)
  // return key ? import.meta.env[key] : fallback
}

export function config(key?: string, fallback?: string) {
  // eslint-disable-next-line no-console
  console.log('key', key, 'fallback', fallback)
  // return key ? configArr[key as string] : fallback
}
