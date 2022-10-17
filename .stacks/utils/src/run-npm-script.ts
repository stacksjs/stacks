import * as ezSpawn from '@jsdevtools/ez-spawn'
import consola from 'consola'
import type { Manifest, NpmScript } from '@stacksjs/types'
import { ExitCode } from 'stacks-init/src/commands/exit-code'
import { frameworkPath } from '../../src/helpers'
import { isManifest } from './manifest'
import { readJsonFile } from './fs'

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
function hasScript(manifest: Manifest, script: NpmScript): boolean {
  const scripts = manifest.scripts as Record<NpmScript, string> | undefined

  if (scripts && typeof scripts === 'object')
    return Boolean(scripts[script])

  return false
}
