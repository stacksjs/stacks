import type { NpmScript } from '@stacksjs/enums'
import type { Result } from '@stacksjs/error-handling'
import type { CliOptions, Manifest, Subprocess } from '@stacksjs/types'
import type { AddressInfo } from 'node:net'
import { runAction } from '@stacksjs/actions'
import { log, runCommand } from '@stacksjs/cli'
import { app, ui } from '@stacksjs/config'
import { Action } from '@stacksjs/enums'
import { err, handleError, ok } from '@stacksjs/error-handling'
import { frameworkPath, projectPath } from '@stacksjs/path'
import { fs, readJsonFile, readPackageJson, readTextFile, writeTextFile } from '@stacksjs/storage'
import { parse } from 'yaml'

// import { semver } from './versions'

export async function packageManager(): Promise<string> {
  const { packageManager } = await readPackageJson(frameworkPath('package.json'))
  return packageManager
}

export async function initProject(): Promise<Result<Subprocess, Error>> {
  if (app.env !== 'production')
    log.info('Project not yet initialized, generating application key...')
  else handleError('Please run `buddy key:generate` to generate an application key')

  const result = await runAction(Action.KeyGenerate, { cwd: projectPath() })

  if (result.isErr())
    return err(handleError(result.error))

  log.info('Application key generated.')

  return ok(result.value)
}

export async function ensureProjectIsInitialized(): Promise<boolean> {
  // if (storage.isFile(projectPath('.env')))
  if (fs.existsSync(projectPath('.env')))
    return await isAppKeySet()

  // copy the .env.example file to .env
  if (fs.existsSync(projectPath('.env.example')))
    await runCommand('cp .env.example .env', { cwd: projectPath() })
  else console.error('no .env.example file found')

  return await isAppKeySet()
}

export async function installIfVersionMismatch(): Promise<void> {
  // const requiredBunVersion = '0.8.1'
  // const installedBunVersion = process.version
  // if (!semver.satisfies(installedBunVersion, requiredBunVersion)) {
  //   log.warn(`Installed Bun version ${italic(installedBunVersion)} does not satisfy required version ${italic(requiredBunVersion)}. Adding it to your environment. One moment...`)
  //   await runCommand(`tea +bun.sh${requiredBunVersion} >/dev/null 2>&1`)
  // }
}

export async function frameworkVersion(): Promise<string> {
  return (await readPackageJson(frameworkPath('package.json'))).version
}

export async function isAppKeySet(): Promise<boolean> {
  const env = await readTextFile('.env', projectPath())
  const lines = env.data.split('\n')
  const appKey = lines.find(line => line.startsWith('APP_KEY='))

  return !!(appKey && appKey.length > 16)
}

/**
 * Determines the utilized reset preset.
 *
 * @url https://www.npmjs.com/package/@unocss/reset
 * @param preset
 */
export function determineResetPreset(preset?: string): string[] {
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

/**
 * Determines whether the specified value is a package manifest.
 */
export function isManifest(obj: any): obj is Manifest {
  return (
    obj
    && typeof obj === 'object'
    && isOptionalString(obj.name)
    && isOptionalString(obj.version)
    && isOptionalString(obj.description)
  )
}

/**
 * Determines whether the specified value is a string, null, or undefined.
 */
export function isOptionalString(value: any): value is string | undefined {
  const type = typeof value
  return value === null || type === 'undefined' || type === 'string'
}

export async function setEnvValue(key: string, value: string): Promise<void> {
  const file = await readTextFile(projectPath('.env'))

  await writeTextFile({
    path: projectPath('.env'),
    data: file.data.replace(/APP_KEY=/g, `APP_KEY=${value}`), // todo: do not hardcode the APP_KEY here and instead use the key parameter
  })
}

/**
 * Runs the specified NPM script in the package.json file.
 */
export async function runNpmScript(script: NpmScript, options?: CliOptions): Promise<Result<Subprocess, Error>> {
  const { data: manifest } = await readJsonFile('package.json', frameworkPath())

  // simple, yet effective check to see if the script exists
  if (isManifest(manifest) && hasScript(manifest, script))
    return await runCommand(`bun run ${script}`, options)

  return err(handleError(`The ${script} script does not exist in the package.json file.`))
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

export function parseYaml(content: any): any {
  return parse(content)
}

/**
 * Determines the level of debugging.
 *
 * The debug level is determined by the following:
 * 1. The --verbose flag
 * 2. The debug property in the app configuration
 *
 * Currently, we don't support a custom debug level,
 * though, we would like to in the future.
 *
 * @param options
 */
export function determineDebugLevel(options?: CliOptions): boolean {
  if (options?.verbose === true)
    return true

  return app.debug === true
}

export function isIpv6(address: AddressInfo): boolean {
  return (
    address.family === 'IPv6'
    // in node >=18.0 <18.4 this was an integer value. This was changed in a minor version.
    // See: https://github.com/laravel/vite-plugin/issues/103

    // @ts-expect-error-next-line
    || address.family === 6
  )
}

export { dump as dumpYaml, load as loadYaml } from 'js-yaml'
