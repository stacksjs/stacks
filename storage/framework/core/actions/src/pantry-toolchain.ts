/**
 * The Pantry a release regenerates `pantry.lock` with.
 *
 * A release used to run whichever `pantry` came first on PATH. Lockfile output
 * differs between Pantry versions, so a release cut on a machine with an older
 * global install rewrote the lock CI validates with the declared one: v0.75.238
 * was cut with a global 0.11.80 against locks written by 0.11.103, put back the
 * ~800 entries the 0.11.103 workspace installer had dropped, and turned
 * `compile` red on main the moment it landed.
 *
 * The workspace already declares the toolchain: `ts-pantry`, the SDK that
 * ships with each Pantry release, in `@stacksjs/buddy`'s dependencies for the
 * framework and in the root manifest for an app. CI installs that same version.
 * So the release resolves its Pantry (`PANTRY_BIN`, else `pantry` on PATH),
 * asks it its version, and refuses before anything is bumped when the version
 * does not satisfy the declared range.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface PantryToolchainOptions {
  /** The project being released. */
  cwd: string
  env?: Record<string, string | undefined>
  /** Runs `<bin> --version`; injectable for tests. */
  probe?: (bin: string) => { exitCode: number, stdout: string }
}

export type PantryToolchain
  = | { ok: true, bin: string, version: string, declared?: string, declaredIn?: string }
    | { ok: false, bin: string, message: string }

/** `pantry 0.11.103 (986749281)` → `0.11.103`. */
export function parsePantryVersion(output: string): string | undefined {
  return /\bpantry\s+v?(\d+\.\d+\.\d+(?:-[\w.]+)?)/i.exec(output)?.[1]
}

/**
 * The `ts-pantry` range this workspace declares, and the manifest it came from.
 * The framework declares it on `@stacksjs/buddy`, which runs Pantry; an app
 * declares it in its own manifest, if at all.
 */
export function declaredPantryRange(cwd: string): { range: string, file: string } | undefined {
  for (const file of ['storage/framework/core/buddy/package.json', 'package.json']) {
    const path = join(cwd, file)
    if (!existsSync(path))
      continue
    try {
      const manifest = JSON.parse(readFileSync(path, 'utf8')) as Record<string, Record<string, string> | undefined>
      const range = manifest.dependencies?.['ts-pantry'] ?? manifest.devDependencies?.['ts-pantry']
      if (range)
        return { range, file }
    }
    catch {
      // An unreadable manifest declares nothing; the next one may.
    }
  }
  return undefined
}

function probeVersion(bin: string): { exitCode: number, stdout: string } {
  try {
    const result = Bun.spawnSync([bin, '--version'], { stdout: 'pipe', stderr: 'pipe' })
    return { exitCode: result.exitCode ?? 1, stdout: `${result.stdout.toString()}${result.stderr.toString()}` }
  }
  catch {
    return { exitCode: 127, stdout: '' }
  }
}

/** Resolve the Pantry this release will run, and check it against the declared toolchain. */
export function resolvePantryToolchain(options: PantryToolchainOptions): PantryToolchain {
  const env = options.env ?? process.env
  const bin = env.PANTRY_BIN?.trim() || 'pantry'
  const result = (options.probe ?? probeVersion)(bin)
  const version = result.exitCode === 0 ? parsePantryVersion(result.stdout) : undefined
  if (!version) {
    return {
      ok: false,
      bin,
      message: `Release aborted: could not run \`${bin} --version\`, so the Pantry that would regenerate pantry.lock is unknown. `
        + 'Install the declared Pantry, or set PANTRY_BIN to it, then re-run.',
    }
  }

  const declared = declaredPantryRange(options.cwd)
  if (declared && !Bun.semver.satisfies(version, declared.range)) {
    return {
      ok: false,
      bin,
      message: `Release aborted before any file changed: \`${bin}\` is Pantry ${version}, but ${declared.file} declares ts-pantry ${declared.range}. `
        + 'A different Pantry writes a different pantry.lock than the one CI validates. '
        + 'Set PANTRY_BIN to a Pantry that satisfies the declared range (or put one first on PATH), then re-run.',
    }
  }

  return { ok: true, bin, version, declared: declared?.range, declaredIn: declared?.file }
}
