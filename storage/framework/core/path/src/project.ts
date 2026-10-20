import { existsSync, lstatSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
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

const VENDORED_DEFAULTS = 'framework/defaults'

const packagedDefaultsRoots = new Map<string, string | null>()

/**
 * Whether a resolved `@stacksjs/defaults` is a copy the project installed.
 *
 * With none installed, Bun answers from its own auto-install cache
 * (`~/.bun/install/cache/@stacksjs/defaults@x@@@1`, or
 * `<repo>/pantry/install/cache/...` on CI): a release nobody declared. A test
 * running in a temp directory then loaded that release's models.
 */
export function isInstalledDefaultsRoot(path: string): boolean {
  return /[/\\]@stacksjs[/\\]defaults$/.test(path) && !/[/\\]install[/\\]cache[/\\]/.test(path)
}

/**
 * Where the installed `@stacksjs/defaults` lives for a project, or null when
 * it is not installed. Resolved through `package.json` because the package
 * publishes no `.` export, and memoised per project root: it cannot move
 * without a reinstall, and this sits under every `storagePath()` call that
 * names the defaults tree.
 */
export function packagedDefaultsRoot(projectRoot: string = projectPath()): string | null {
  const cached = packagedDefaultsRoots.get(projectRoot)
  if (cached !== undefined)
    return cached

  let root: string | null = null
  try {
    const resolved = dirname(Bun.resolveSync('@stacksjs/defaults/package.json', projectRoot))
    if (isInstalledDefaultsRoot(resolved))
      root = resolved
  }
  catch {
    // Not installed. The vendored path is the only answer there is.
  }

  packagedDefaultsRoots.set(projectRoot, root)
  return root
}

/**
 * Whether this project keeps its own copy of the framework defaults in
 * `storage/framework/defaults`: a real directory, not the link
 * {@link linkPackagedDefaults} makes.
 *
 * A framework checkout always does (it is the source the package is built
 * from), and so does an app created before the defaults moved into
 * `node_modules`, or with `buddy new --vendor-defaults`. A new app does not:
 * the 2,600-odd files are identical to the installed `@stacksjs/defaults`, so
 * committing them only gave every project a copy to drift.
 */
export function usesVendoredDefaults(projectRoot: string = projectPath()): boolean {
  try {
    return lstatSync(join(projectRoot, 'storage', VENDORED_DEFAULTS)).isDirectory()
  }
  catch {
    return false
  }
}

/**
 * Point `storage/framework/defaults` at the installed `@stacksjs/defaults`
 * when the project does not vendor the tree.
 *
 * The link is gitignored, so it costs the repository nothing, and it keeps
 * every path that names the tree directly working: a `~/storage/framework/
 * defaults/...` import in an app's own template, an editor jumping to a
 * default action, a tool that globs the views. `storagePath()` already falls
 * back to the package without it; the link is for everything that does not
 * ask `@stacksjs/path`.
 *
 * Idempotent and cheap (one lstat when the link is in place), so boot calls it.
 * A vendored directory is never touched. A dangling link, left behind when
 * `node_modules` moved, is replaced. Returns whether a link was written.
 */
export function linkPackagedDefaults(projectRoot: string = projectPath()): boolean {
  const link = join(projectRoot, 'storage', VENDORED_DEFAULTS)

  let existing: ReturnType<typeof lstatSync> | undefined
  try {
    existing = lstatSync(link)
  }
  catch {
    // Nothing there yet.
  }

  if (existing && !existing.isSymbolicLink())
    return false
  if (existing && existsSync(link))
    return false

  // Only a Stacks project has a storage/framework to put the link in.
  if (!existsSync(dirname(link)))
    return false

  const target = packagedDefaultsRoot(projectRoot)
  if (!target)
    return false

  try {
    if (existing)
      rmSync(link, { force: true })
    // Relative, so the project can move without breaking it. Both ends real
    // paths: the package root comes back resolved (`/private/var` for
    // `/var` on macOS), and mixing the two yields a path through `/`.
    symlinkSync(relative(realpathSync(dirname(link)), realpathSync(target)), link, 'dir')
    return true
  }
  catch {
    // A read-only deploy, or a filesystem without symlinks. storagePath()
    // resolves the package regardless, so this is a convenience lost, not a
    // broken app.
    return false
  }
}

/**
 * The framework defaults tree this project runs: the vendored
 * `storage/framework/defaults` when it is a real directory, otherwise the
 * installed `@stacksjs/defaults` package. The vendored path is returned when
 * neither exists, so a caller reports the path it has always reported.
 *
 * The package's own path even when the link to it is in place. The link is for
 * people and tools; boot creates it, and a module resolved through a link made
 * after the process started fails in Bun, whose resolver has already cached the
 * directory as missing (`Unexpected while resolving package`, for every
 * default model on a fresh clone's first boot).
 */
export function frameworkDefaultsRoot(projectRoot: string = projectPath()): string {
  const vendored = join(projectRoot, 'storage', VENDORED_DEFAULTS)
  if (usesVendoredDefaults(projectRoot))
    return vendored

  return packagedDefaultsRoot(projectRoot) ?? vendored
}

/**
 * `storage/<path>`, except that `framework/defaults/...` follows
 * {@link frameworkDefaultsRoot}. Every caller that names a default model,
 * action, view or route through here (and through `frameworkPath`) therefore
 * works the same whether the app vendors the tree or not.
 */
export function storagePath(path?: string): string {
  const sub = path || ''

  if (sub === VENDORED_DEFAULTS || sub.startsWith(`${VENDORED_DEFAULTS}/`))
    return resolve(frameworkDefaultsRoot(), `.${sub.slice(VENDORED_DEFAULTS.length)}`)

  return projectPath(`storage/${sub}`)
}

export function frameworkPath(path?: string, options?: { relative?: boolean, cwd?: string }): string {
  const absolutePath = storagePath(`framework/${path || ''}`)

  if (options?.relative)
    return relative(options.cwd || process.cwd(), absolutePath)

  return absolutePath
}
