import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { dependencyLayers } from './dependency-layers'

export interface WorkspaceBuildResult {
  name: string
  dir: string
  exitCode: number | null
  blockedBy: string[]
}

/** Public packages with build scripts, including the workspace's own umbrella. */
export function workspaceBuildTargets(root: string): string[] {
  const candidates = [...readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => join(root, entry.name)), root]
  return candidates.filter((dir) => {
    const path = join(dir, 'package.json')
    if (!existsSync(path)) return false
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as { private?: boolean, scripts?: Record<string, string> }
    return !manifest.private && !!manifest.scripts?.build
  })
}

/** Build the selected workspace packages and retain every unsuccessful result. */
export async function buildWorkspacePackages(dirs: readonly string[]): Promise<WorkspaceBuildResult[]> {
  const packages = dirs.map((dir) => {
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: string, scripts?: Record<string, string>, dependencies?: Record<string, string> }
    if (!manifest.name || !manifest.scripts?.build) throw new Error(`Not a buildable workspace package: ${dir}`)
    return { name: manifest.name, dir, dependencies: Object.keys(manifest.dependencies ?? {}) }
  })
  const layers = dependencyLayers(packages)
  const results: WorkspaceBuildResult[] = []
  for (const { name, dir, dependencies } of layers.flat()) {
    const blockedBy = results.filter(result => result.exitCode !== 0 && dependencies.includes(result.name)).map(result => result.name)
    if (blockedBy.length) {
      console.error(`Cannot build ${dir}: dependencies failed: ${blockedBy.join(', ')}`)
      results.push({ name, dir, exitCode: null, blockedBy })
      continue
    }
    console.log(`Building ${dir}`)
    const child = Bun.spawn([process.execPath, 'run', 'build'], { cwd: dir, stdout: 'inherit', stderr: 'inherit' })
    results.push({ name, dir, exitCode: await child.exited, blockedBy: [] })
  }
  return results
}
