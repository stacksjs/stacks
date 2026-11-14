import type { LibraryConfig } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { configuredLibrary, LibraryConfigError, resolveLibraryPackages } from './packages'

export interface LibraryPublishPlan {
  name: string
  version: string
  dir: string
  access: 'public' | 'restricted'
  registry: 'pantry' | 'npm'
  tarballFiles: number
}

/**
 * Work out what a publish would push, and refuse anything that would ship an
 * empty or stale tarball.
 *
 * The framework has shipped a dist-less package to npm before, more than once,
 * because the publish step ran with `--ignore-scripts` and nothing checked
 * that a build had happened first. This is that check, ahead of time.
 */
export async function planLibraryPublish(config?: LibraryConfig): Promise<LibraryPublishPlan[]> {
  const packages = await resolveLibraryPackages(config ?? await configuredLibrary())
  const publishable = packages.filter(pkg => !pkg.private)

  if (!publishable.length)
    throw new LibraryConfigError('Every configured library package is marked private. Nothing to publish.')

  const plans: LibraryPublishPlan[] = []
  const missing: string[] = []

  for (const pkg of publishable) {
    const manifestPath = resolve(pkg.dir, 'package.json')
    const distDir = resolve(pkg.dir, 'dist')

    if (!existsSync(manifestPath) || !existsSync(distDir)) {
      missing.push(pkg.name)
      continue
    }

    const built = await Array.fromAsync(new Bun.Glob('**/*.{js,css,json,d.ts}').scan({ cwd: distDir }))

    if (!built.length) {
      missing.push(pkg.name)
      continue
    }

    const manifest = await Bun.file(manifestPath).json() as { version?: string }

    plans.push({
      name: pkg.name,
      version: manifest.version ?? '0.0.0',
      dir: pkg.dir,
      access: pkg.access,
      registry: pkg.registry,
      tarballFiles: built.length,
    })
  }

  if (missing.length) {
    throw new LibraryConfigError(
      `These packages have no build output: ${missing.join(', ')}.\nRun \`buddy build:libs\` before publishing.`,
    )
  }

  return plans
}

/**
 * The publisher to shell out to for a package bound for `registry`.
 *
 * `pantry publish` first. Pantry is this project's package manager, it is what
 * the release workflows already install, and it is the only one of the three
 * that publishes to the Pantry registry. A Pantry-bound package therefore
 * needs it: falling back to `bun publish` sent such a release to npm and
 * nowhere else, so that is refused rather than done quietly.
 *
 * An npm-bound package (`registry: 'npm'`) goes through `pantry publish --npm`,
 * or `bun publish` and then `npm publish` when pantry is not installed. Neither
 * of those is guaranteed present either (npm was not on the machine this was
 * written on, and hardcoding it turned `libs:publish` into an ENOENT), so the
 * choice is made from what is actually on PATH.
 *
 * Every publisher takes the flags the caller adds: `--access` and `--dry-run`
 * mean the same thing to all three.
 */
export function publishCommand(registry: 'pantry' | 'npm' = 'pantry', which: (bin: string) => string | null = Bun.which, tag?: string): string[] {
  if (tag !== undefined && (!/^[a-z][a-z0-9_-]{0,63}$/.test(tag) || /^v\d/.test(tag)))
    throw new LibraryConfigError('Use a lower-case distribution tag such as alpha, next or latest, not a version or range.')
  const tagged = (command: string[]) => tag === undefined ? command : [...command, '--tag', tag]
  if (which('pantry'))
    return tagged(registry === 'npm' ? ['pantry', 'publish', '--npm'] : ['pantry', 'publish'])

  if (registry === 'pantry')
    throw new Error('This package publishes to the Pantry registry, which only `pantry publish` reaches, and `pantry` is not on PATH. Install pantry, or set `registry: \'npm\'` on the package in config/library.ts.')

  if (which('bun'))
    return tagged(['bun', 'publish'])

  if (which('npm'))
    return tagged(['npm', 'publish'])

  throw new Error('None of `pantry`, `bun` or `npm` is on PATH, so there is nothing to publish with.')
}

/**
 * Publish each built package.
 *
 * One package per invocation rather than a workspace-wide publish: these live
 * outside the framework workspace on purpose, and publishing them one at a
 * time means a failure names the package that failed instead of leaving the
 * set half-published with no record of where it stopped.
 */
export async function publishLibraryPackages(options: { dryRun?: boolean, tag?: string, config?: LibraryConfig } = {}): Promise<LibraryPublishPlan[]> {
  // Validate before config or publisher execution, including when the package set is empty.
  if (options.tag !== undefined) publishCommand('npm', bin => bin === 'bun' ? 'bun' : null, options.tag)
  const plans = await planLibraryPublish(options.config)

  for (const plan of plans) {
    const args = [...publishCommand(plan.registry, Bun.which, options.tag), '--access', plan.access]

    if (options.dryRun)
      args.push('--dry-run')

    log.info(`${options.dryRun ? '[dry run] ' : ''}${args.join(' ')}  (${plan.name}@${plan.version}, ${relative(projectPath(), plan.dir)})`)

    const proc = Bun.spawnSync({ cmd: args, cwd: plan.dir, stdout: 'inherit', stderr: 'inherit' })

    if (proc.exitCode !== 0)
      throw new Error(`Publishing ${plan.name}@${plan.version} failed with exit code ${proc.exitCode}.`)
  }

  return plans
}
