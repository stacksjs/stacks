import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWorkspacePackages, workspaceBuildTargets } from '../../storage/framework/core/build/src/workspace'

/** Releases build every publishable package, independent of app feature flags. */
export async function frameworkBuildTargets(root: string): Promise<string[]> {
  return workspaceBuildTargets(join(root, 'storage/framework/core'))
}

/** The umbrella owns child builds; running those separately would build twice. */
export async function buildFramework(root: string) {
  const umbrella = join(root, 'storage/framework/core')
  if (!(await frameworkBuildTargets(root)).includes(umbrella)) throw new Error('The framework umbrella has no public build script')
  return buildWorkspacePackages([umbrella])
}

if (import.meta.main) {
  const root = resolve(fileURLToPath(new URL('../../', import.meta.url)))
  const results = await buildFramework(root)
  const failed = results.filter(result => result.exitCode !== 0)
  if (failed.length) {
    console.error(`Framework builds failed or were blocked: ${failed.map(result => result.name).join(', ')}`)
    process.exitCode = 1
  }
}
