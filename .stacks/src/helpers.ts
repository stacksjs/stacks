import { isFile, readTextFile } from 'stacks:fs'
import ezSpawn from '@jsdevtools/ez-spawn'
import { resolve } from 'pathe'
import type { Manifest } from 'types'
import { ui } from 'config'

export async function isInitialized() {
  if (isFile('.env'))
    return await checkIfAppKeyIsSet()

  if (isFile('.env.example'))
    await ezSpawn.async('cp .env.example .env', { stdio: 'inherit', cwd: projectPath() })

  return await checkIfAppKeyIsSet()
}

export async function checkIfAppKeyIsSet() {
  const env = await readTextFile('.env', projectPath())
  const lines = env.data.split('\n')
  const appKey = lines.find(line => line.startsWith('APP_KEY='))

  if (appKey && appKey.length > 16)
    return true

  return false
}

/**
 * Determines the utilized reset preset.
 *
 * @url https://www.npmjs.com/package/@unocss/reset
 * @param preset
 */
export function determineResetPreset(preset?: string) {
  if (ui.reset)
    preset = ui.reset

  if (preset === 'tailwind')
    return ['import \'@unocss/reset/tailwind.css\'']

  if (preset === 'normalize')
    return ['import \'@unocss/reset/normalize.css\'']

  if (preset === 'sanitize')
    return ['import \'@unocss/reset/sanitize/sanitize.css\'', 'import \'@unocss/reset/sanitize/assets.css']

  if (preset === 'eric-meyer')
    return ['import \'@unocss/reset/eric-meyer.css\'']

  if (preset === 'antfu')
    return ['import \'@unocss/reset/antfu.css\'']

  return []
}

export function libraryEntryPath(type: 'vue-components' | 'web-components' | 'functions') {
  return buildEntriesPath(`${type}.ts`)
}

export function buildEntriesPath(path?: string) {
  return frameworkPath(`build/entries/${path || ''}`)
}

export function actionsPath(path?: string) {
  return frameworkPath(`actions/${path || ''}`)
}

export function buildEnginePath(path?: string) {
  return frameworkPath(`build/${path || ''}`)
}

export function modulesPath(path?: string) {
  return frameworkPath(`modules/${path || ''}`)
}

export function pagesEnginePath(path?: string) {
  return frameworkPath(`pages/${path || ''}`)
}

export function routerPath(path?: string) {
  return frameworkPath(`router/${path || ''}`)
}

export function typesPath(path?: string) {
  return frameworkPath(`types/${path || ''}`)
}

export function uiEnginePath(path?: string) {
  return frameworkPath(`ui/${path || ''}`)
}

export function scriptsPath(path?: string) {
  return frameworkPath(`scripts/${path || ''}`)
}

export function customElementsDataPath() {
  return frameworkPath('custom-elements.json')
}

export function componentsPath(path?: string) {
  return projectPath(`components/${path || ''}`)
}

export function pagesPath(path?: string) {
  return projectPath(`pages/${path || ''}`)
}

export function functionsPath(path?: string) {
  return projectPath(`functions/${path || ''}`)
}

export function cliPath(path?: string) {
  return frameworkPath(`cli/${path || ''}`)
}

export function configPath(path?: string) {
  return frameworkPath(`config/${path || ''}`)
}

export function routesPath(path?: string) {
  return projectPath(`routes/${path || ''}`)
}

export function langPath(path?: string) {
  return projectPath(`lang/${path || ''}`)
}

export function frameworkPath(path?: string) {
  return projectPath(`.stacks/${path || ''}`)
}

export function projectPath(filePath = '') {
  let path = process.cwd()

  // workaround: run the follow command a few times because there is chance
  // that the cwd is a few dirs up, like in the case when a release happens
  // from a GitHub Action/workflow
  if (path.includes('.stacks'))
    path = resolve(path, '..')

  if (path.includes('.stacks'))
    path = resolve(path, '..')

  if (path.includes('.stacks'))
    path = resolve(path, '..')

  if (!path.includes('.stacks'))
    path = resolve(path, '.')

  return resolve(path, filePath)
}

export function examplesPath(type: 'vue-components' | 'web-components') {
  return frameworkPath(`examples/${type || ''}`)
}

export function packageJsonPath(type: 'vue-components' | 'web-components' | 'functions') {
  return frameworkPath(`./${type}/package.json`)
}

export function env(key?: string, fallback?: any) {
  // eslint-disable-next-line no-console
  console.log('isClient', isClient)
  // if (key && import.meta?.env)
  //   return import.meta.env[key]

  return fallback
}

export function config(key?: string, fallback?: string) {
  // eslint-disable-next-line no-console
  console.log('key', key, 'fallback', fallback)
  // return key ? configArr[key as string] : fallback
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
