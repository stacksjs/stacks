import * as ezSpawn from '@jsdevtools/ez-spawn'
import consola from 'consola'
import { ExitCode } from 'types'
import type { Manifest, NpmScript } from 'types'
import { frameworkPath, isManifest } from 'framework/utils/src/helpers'
import { readJsonFile } from 'stacks:fs'

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
