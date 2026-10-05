import { existsSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import process from 'node:process'

let cachedCwd: string | undefined
let cachedProjectRoot = ''

/**
 * The project a working directory belongs to.
 *
 * A command run from inside `<project>/storage/...` - a package's tests, a
 * framework script - belongs to `<project>`. This used to climb while the path
 * merely CONTAINED the text "storage", so a project kept anywhere under such a
 * name resolved above itself: `/mnt/storage/app` became `/mnt`, and
 * `~/Code/storagehq` became `~/Code`, after which every config, model and
 * migration path pointed outside the project.
 *
 * Now only a path segment that is exactly `storage` counts, and only when the
 * directory above it is a Stacks project: it holds `storage/framework`, or at
 * least a `package.json`. A working directory that is itself a project root is
 * that root.
 */
function projectRootFor(cwd: string): string {
  if (existsSync(join(cwd, 'storage', 'framework')))
    return cwd

  const segments = cwd.split(sep)
  const candidates: string[] = []
  for (let i = segments.length - 1; i > 0; i--) {
    if (segments[i] === 'storage')
      candidates.push(segments.slice(0, i).join(sep) || sep)
  }

  return candidates.find(candidate => existsSync(join(candidate, 'storage', 'framework')))
    ?? candidates.find(candidate => existsSync(join(candidate, 'package.json')))
    ?? cwd
}

export function projectPath(filePath = '', options?: { relative: boolean }): string {
  const cwd = process.cwd()
  let path: string

  if (cwd === cachedCwd) {
    path = cachedProjectRoot
  }
  else {
    path = projectRootFor(cwd)
    cachedCwd = cwd
    cachedProjectRoot = path
  }

  const finalPath = resolve(path, filePath)

  if (options?.relative)
    return relative(process.cwd(), finalPath)

  return finalPath
}

export function appPath(path?: string, options?: { relative?: boolean, cwd?: string }): string {
  const absolutePath = projectPath(`app/${path || ''}`)

  if (options?.relative)
    return relative(options.cwd || process.cwd(), absolutePath)

  return absolutePath
}

export function storagePath(path?: string): string {
  return projectPath(`storage/${path || ''}`)
}

export function frameworkPath(path?: string, options?: { relative?: boolean, cwd?: string }): string {
  const absolutePath = storagePath(`framework/${path || ''}`)

  if (options?.relative)
    return relative(options.cwd || process.cwd(), absolutePath)

  return absolutePath
}
