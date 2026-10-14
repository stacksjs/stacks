/**
 * The iOS build's command-line tools, from Pantry.
 *
 * `build:ios` generates the Xcode project with xcodegen, and Craft used to run
 * whichever `xcodegen` came first on PATH: Homebrew's on one machine, a copied
 * binary on another. Two builds of the same commit could differ and nothing
 * said so. The versions now come from `iosDependencies` in config/deps.ts (the
 * iOS counterpart of `androidDependencies`), or the framework default below,
 * and the binary from a Pantry install of exactly that package. PATH is never
 * consulted: a tool Pantry did not install is an error that says how to get it.
 *
 * Xcode is the exception. It is not a Pantry package and cannot be one (Apple
 * ships it only through the App Store and developer.apple.com), so it is
 * checked for, not installed.
 */

import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const XCODEGEN_PACKAGE = 'github.com/yonaskolb/XcodeGen'

/** The tools `build:ios` runs, when config/deps.ts declares no `iosDependencies`. */
export const DEFAULT_IOS_DEPENDENCIES: Readonly<Record<string, string>> = {
  [XCODEGEN_PACKAGE]: '^2.46.0',
}

export const XCODE_NOTE = 'Xcode itself does not come from Pantry: install it from the Mac App Store or developer.apple.com, then select it with `sudo xcode-select --switch /Applications/Xcode.app`.'

export interface PantryTool {
  /** The Pantry package, e.g. `github.com/yonaskolb/XcodeGen`. */
  pkg: string
  /** The range config/deps.ts asks for. */
  constraint: string
  /** The installed version that satisfies it. */
  version: string
  /** Absolute path of the program. */
  path: string
}

export class IosToolchainError extends Error {
  override name = 'IosToolchainError'
}

type Env = Record<string, string | undefined>

interface Filesystem {
  exists: (path: string) => boolean
  list: (path: string) => string[]
}

const realFilesystem: Filesystem = {
  exists: existsSync,
  list: (path) => {
    try {
      return readdirSync(path)
    }
    catch {
      return []
    }
  },
}

/**
 * Where Pantry keeps installed packages, most specific first: the project's
 * own `pantry/`, the user install (`pantry install --user`, which `setup:ios`
 * uses), then a system-wide one.
 */
export function pantryPackageRoots(projectRoot: string, env: Env = process.env): string[] {
  const home = env.HOME || homedir()
  const data = env.XDG_DATA_HOME || join(home, '.local', 'share')
  return [
    join(projectRoot, 'pantry'),
    join(data, 'pantry', 'global', 'packages'),
    '/usr/local/packages',
  ]
}

/**
 * The highest installed version of `pkg` under `roots` that satisfies
 * `constraint` and ships `program`, searching the roots in order.
 */
export function findPantryProgram(
  pkg: string,
  constraint: string,
  program: string,
  roots: string[],
  fs: Filesystem = realFilesystem,
): PantryTool | null {
  for (const root of roots) {
    const versions = fs.list(join(root, pkg))
      .filter(entry => /^v\d+\.\d+\.\d+$/.test(entry))
      .map(entry => entry.slice(1))
      .filter(version => Bun.semver.satisfies(version, constraint))
      .sort((a, b) => Bun.semver.order(b, a))
    for (const version of versions) {
      const path = join(root, pkg, `v${version}`, 'bin', program)
      if (fs.exists(path))
        return { pkg, constraint, version, path }
    }
  }
  return null
}

/**
 * `iosDependencies` from config/deps.ts over the framework default, so an app
 * that pins one tool still gets the others.
 */
export async function loadIosDependencies(projectRoot: string): Promise<Record<string, string>> {
  const depsPath = join(projectRoot, 'config', 'deps.ts')
  if (!existsSync(depsPath))
    return { ...DEFAULT_IOS_DEPENDENCIES }
  const deps = await import(pathToFileURL(depsPath).href) as { iosDependencies?: Record<string, string> }
  return { ...DEFAULT_IOS_DEPENDENCIES, ...(deps.iosDependencies ?? {}) }
}

/** `pantry install` arguments for the iOS tools, into the user install. */
export function pantryInstallArgs(dependencies: Record<string, string>): string[] {
  return ['install', '--user', '--no-save', ...Object.entries(dependencies).map(([pkg, constraint]) => `${pkg}@${constraint}`)]
}

/** The Pantry executable: PANTRY_BIN, the project's, the user's, else `pantry` on PATH. */
export function pantryExecutable(projectRoot: string, env: Env = process.env, exists: (path: string) => boolean = existsSync): string {
  const home = env.HOME || homedir()
  const data = env.XDG_DATA_HOME || join(home, '.local', 'share')
  const candidates = [
    env.PANTRY_BIN,
    join(projectRoot, 'pantry', '.bin', 'pantry'),
    join(home, '.local', 'bin', 'pantry'),
    join(data, 'pantry', 'global', 'bin', 'pantry'),
  ]
  return candidates.find(candidate => candidate && exists(candidate)) ?? 'pantry'
}

export function missingToolMessage(pkg: string, constraint: string, program: string): string {
  return `${program} ${constraint} is not installed through Pantry, and the iOS build only runs the version config/deps.ts pins `
    + `(\`iosDependencies\`, else the framework default). Run \`buddy setup:ios\`, or \`pantry install --user ${pkg}@${constraint}\`, then build again. `
    + XCODE_NOTE
}

/** xcodegen from Pantry, or an {@link IosToolchainError} that says how to install it. */
export async function resolveXcodegen(projectRoot: string, options: { env?: Env, fs?: Filesystem } = {}): Promise<PantryTool> {
  const dependencies = await loadIosDependencies(projectRoot)
  const constraint = dependencies[XCODEGEN_PACKAGE]!
  const tool = findPantryProgram(XCODEGEN_PACKAGE, constraint, 'xcodegen', pantryPackageRoots(projectRoot, options.env), options.fs)
  if (!tool)
    throw new IosToolchainError(missingToolMessage(XCODEGEN_PACKAGE, constraint, 'xcodegen'))

  // xcodegen reads its default build settings from ../share/xcodegen beside the
  // binary. Without them it still exits 0, and every project it writes silently
  // loses ARC, the warnings, the SDK and the optimisation levels; Pantry's
  // package shipped only the binary until its recipe was fixed (pantry 0cc51d9d1).
  const presets = xcodegenPresets(tool)
  if (!(options.fs ?? realFilesystem).exists(presets)) {
    throw new IosToolchainError(
      `xcodegen ${tool.version} at ${tool.path} has no setting presets (${presets}), so the project it generates would lose its base build settings. `
      // `pantry install --force` keeps a version directory that already exists,
      // so the stale copy has to go before Pantry fetches the fixed package.
      + `Remove ${dirname(dirname(tool.path))} and run \`buddy setup:ios\` to reinstall it.`,
    )
  }
  return tool
}

/** The preset file xcodegen needs beside its binary, at `<prefix>/share/xcodegen`. */
export function xcodegenPresets(tool: PantryTool): string {
  return join(dirname(dirname(tool.path)), 'share', 'xcodegen', 'SettingPresets', 'base.yml')
}

/** Generate `<output>/*.xcodeproj` from its project.yml with the given xcodegen. */
export function generateXcodeProject(xcodegen: PantryTool, output: string): void {
  const result = Bun.spawnSync([xcodegen.path, 'generate', '--quiet'], { cwd: output, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) {
    const detail = `${result.stderr.toString()}${result.stdout.toString()}`.trim()
    throw new IosToolchainError(`xcodegen ${xcodegen.version} (${xcodegen.path}) could not generate the Xcode project in ${output}${detail ? `:\n${detail}` : ''}`)
  }
}

/** The selected Xcode's developer directory, or null when there is none. */
export function xcodeDeveloperDir(): string | null {
  try {
    const result = Bun.spawnSync(['xcode-select', '--print-path'], { stdout: 'pipe', stderr: 'ignore' })
    const path = result.stdout.toString().trim()
    // The Command Line Tools alone cannot build an app.
    return result.exitCode === 0 && path && !path.includes('CommandLineTools') ? path : null
  }
  catch {
    return null
  }
}
