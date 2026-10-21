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

/**
 * Whether this process is a `bun build --compile` binary
 * (stacksjs/stacks#2886).
 *
 * Bun mounts a compiled bundle at a virtual root and reports module paths
 * under it, so the entrypoint is `/$bunfs/root/<name>` instead of a real file.
 * Read off a compiled probe binary rather than taken from documentation:
 *
 *   compiled      Bun.main = /$bunfs/root/probe   import.meta.dir = /$bunfs/root
 *   plain script  Bun.main = /abs/path/probe.ts   import.meta.dir = /abs/path
 *
 * Windows mounts it at `B:\~BUN\root` instead; both separators are accepted
 * because a path can reach here having been normalised either way. That form
 * comes from Bun's own docs and is the one case not verified on this machine.
 *
 * Matched as a whole path SEGMENT. A substring test would read a project
 * directory called `my-$bunfs-notes` as a binary and switch off its model
 * loading, which is a far stranger failure than the one being fixed.
 */
const BUNDLED_ROOT = /(?:^|[/\\])(?:\$bunfs|~BUN)(?:[/\\]|$)/

export function isCompiledBinary(main: string | undefined = Bun.main): boolean {
  // Fail toward the behaviour every non-binary has: if a runtime stops
  // reporting an entrypoint, models should still load rather than silently
  // stop.
  if (!main)
    return false

  return BUNDLED_ROOT.test(main)
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

