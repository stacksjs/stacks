import { log, runCommand, spawn } from '@stacksjs/cli'
import { type CliOptions, ExitCode, type Manifest, type NpmScript } from '@stacksjs/types'
import { frameworkPath, projectPath } from '@stacksjs/path'
import storage from '@stacksjs/storage'
import { ui } from '@stacksjs/config'

export async function isProjectCreated() {
  if (storage.isFile('.env'))
    return await isAppKeySet()

  // copy the .env.example to become the .env file
  if (storage.isFile('.env.example'))
    await spawn('cp .env.example .env', { stdio: 'inherit', cwd: projectPath() })

  return await isAppKeySet()
}

export async function readVersion() {
  const packageJson = await storage.fs.readJson(frameworkPath('package.json'))
  return packageJson.version
}

export async function isAppKeySet() {
  const env = await storage.readTextFile('.env', projectPath())
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
export function isOptionalString(value: any): value is string | undefined {
  const type = typeof value
  return value === null
    || type === 'undefined'
    || type === 'string'
}

export async function setEnvValue(key: string, value: string) {
  const file = await storage.readTextFile(projectPath('.env'))

  await storage.writeTextFile({
    path: projectPath('.env'),
    data: file.data.replace(/APP_KEY=/g, `APP_KEY=${value}`), // todo: do not hardcode the APP_KEY here and instead use the key parameter
  })
}

/**
 * Runs the specified NPM script in the package.json file.
 */
export async function runNpmScript(script: NpmScript, options?: CliOptions) {
  const { data: manifest } = await storage.readJsonFile('package.json', frameworkPath())

  if (isManifest(manifest) && hasScript(manifest, script))
    return await runCommand(`pnpm run ${script}`, { ...options, cwd: frameworkPath() })

  log.error(`The specified npm script "${script}" does not exist in the package.json file`)
  process.exit(ExitCode.FatalError)
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

export * as detectIndent from 'detect-indent'
export { detectNewline } from 'detect-newline'
