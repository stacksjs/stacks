import { resolve } from 'pathe'
import * as ezSpawn from '@jsdevtools/ez-spawn'
import consola from 'consola'
import { readJsonFile } from '../../../src/core/fs'
import type { Manifest, NpmScript } from '../../../src/types'
import { isManifest } from '../../../src/core/manifest'

/**
 * Runs the specified NPM script in the package.json file.
 */
export async function runNpmScript(script: NpmScript) {
  let path = resolve(process.cwd(), '.')

  // in this case, the artisan command was called from the root folder
  // but since the CLI script is store in the .stacks folder, we need to
  // go up one level to find the package.json file
  if (!path.includes('.stacks'))
    path = resolve(path, '.stacks/artisan')

  // eslint-disable-next-line no-console
  console.log('path', path)

  const { data: manifest } = await readJsonFile('package.json', path)

  if (isManifest(manifest) && hasScript(manifest, script))
    await ezSpawn.async('npm', ['run', script], { stdio: 'inherit' })

  else
    consola.error('Error running your Artisan script.')
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
