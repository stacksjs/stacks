import type { LibraryConfig } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { library } from '@stacksjs/config'
import { LibraryConfigError, resolveLibraryPackages } from './packages'

export interface LibraryPublishPlan {
  name: string
  version: string
  dir: string
  access: 'public' | 'restricted'
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
export async function planLibraryPublish(config: LibraryConfig | undefined = library): Promise<LibraryPublishPlan[]> {
  const packages = await resolveLibraryPackages(config)
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
 * The publisher to shell out to.
 *
 * `pantry publish` first. Pantry is this project's package manager, it is what
 * the release workflows already install, and it is the only one of the three
 * that publishes to the Pantry registry — a release that went out through
 * `bun publish` reached npm and nothing else, which is not where these
 * packages are meant to live.
 *
 * It also takes the same flags this function's callers pass: `--access` and
 * `--dry-run` mean what they mean everywhere else, so nothing downstream has
 * to know which publisher was chosen. `--npm` is pantry's own escape hatch for
 * an npm-bound package; it belongs on the package, not here.
 *
 * `bun` and then `npm` remain as fallbacks. Neither is guaranteed present —
 * npm was not on the machine this was written on, and hardcoding it turned
 * `libs:publish` into an ENOENT — so the choice is made from what is actually
 * on PATH rather than assumed.
 */
export function publishCommand(): string[] {
  if (Bun.which('pantry'))
    return ['pantry', 'publish']

  if (Bun.which('bun'))
    return ['bun', 'publish']

  if (Bun.which('npm'))
    return ['npm', 'publish']

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
export async function publishLibraryPackages(options: { dryRun?: boolean, config?: LibraryConfig } = {}): Promise<LibraryPublishPlan[]> {
  const plans = await planLibraryPublish(options.config ?? library)
  const command = publishCommand()

  for (const plan of plans) {
    const args = [...command, '--access', plan.access]

    if (options.dryRun)
      args.push('--dry-run')

    log.info(`${options.dryRun ? '[dry run] ' : ''}${args.join(' ')}  (${plan.name}@${plan.version}, ${relative(projectPath(), plan.dir)})`)

    const proc = Bun.spawnSync({ cmd: args, cwd: plan.dir, stdout: 'inherit', stderr: 'inherit' })

    if (proc.exitCode !== 0)
      throw new Error(`Publishing ${plan.name}@${plan.version} failed with exit code ${proc.exitCode}.`)
  }

  return plans
}
