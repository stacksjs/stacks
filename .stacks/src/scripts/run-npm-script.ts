import { resolve } from 'pathe'
import * as ezSpawn from '@jsdevtools/ez-spawn'
import { readJsonFile } from '../core/fs'
import type { Manifest } from '../core/manifest'
import { isManifest } from '../core/manifest'
import type { NpmScript } from '../types/cli'

/**
 * Runs the specified NPM script in the package.json file.
 */
export async function runNpmScript(script: NpmScript) {
  const path = resolve(process.cwd())
  const { data: manifest } = await readJsonFile('package.json', path)

  if (isManifest(manifest) && hasScript(manifest, script))
    await ezSpawn.async('npm', ['run', script], { stdio: 'inherit' })
  // await ezSpawn.async('npm', ['run', script, '--silent'], { stdio: 'inherit' })
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
