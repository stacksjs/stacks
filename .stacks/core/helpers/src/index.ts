import consola from 'consola'
import { ExitCode, type Manifest, type NpmScript } from '@stacksjs/types'
import { frameworkPath } from '@stacksjs/paths'
import { isFile, readJsonFile, readTextFile, writeTextFile } from '@stacksjs/fs'
import ezSpawn from '@jsdevtools/ez-spawn'
import { ui } from '../../../config'

export async function isAppInitialized() {
  if (isFile('.env'))
    return await isAppKeySet()

  if (isFile('.env.example'))
    await ezSpawn.async('cp .env.example .env', { stdio: 'inherit', cwd: projectPath() })

  return await isAppKeySet()
}

export async function isAppKeySet() {
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

export function env(key?: string, fallback?: any) {
  // console.log('isClient', isClient)
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

export async function setEnvValue(key: string, value: string) {
  const file = await readTextFile(projectPath('.env'))

  await writeTextFile({
    path: projectPath('.env'),
    data: file.data.replace(/APP_KEY=/g, `APP_KEY=${value}`), // todo: do not hardcode the APP_KEY here and instead use the key parameter
  })
}

/**
 * Runs the specified NPM script in the package.json file.
 */
export async function runNpmScript(script: NpmScript, debug: 'ignore' | 'inherit' = 'inherit') {
  const path = frameworkPath()

  const { data: manifest } = await readJsonFile('package.json', path)

  if (isManifest(manifest) && hasScript(manifest, script)) {
    await ezSpawn.async('pnpm', ['run', script], { stdio: debug, cwd: path })
  }

  else {
    consola.error('Error running your Artisan script.')
    process.exit(ExitCode.FatalError)
  }
}

/**
 * Determines whether the specified NPM script exists in the given manifest.
 */
export function hasScript(manifest: Manifest, script: NpmScript): boolean {
  const scripts = manifest.scripts as Record<NpmScript, string> | undefined

  if (scripts && typeof scripts === 'object')
    return Boolean(scripts[script])

  return false
}
