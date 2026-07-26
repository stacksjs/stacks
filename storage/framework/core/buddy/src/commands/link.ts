import type { CLI } from '@stacksjs/types'
import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs'
import fs from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { italic, log } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy link:core` / `buddy unlink:core` — develop the framework from an app.
 *
 * An app that runs on the published packages has no way to try a framework
 * change without releasing it: edit, commit, release, wait for CI, bump, test,
 * discover the typo. Linking points the app's `@stacksjs/*` at a local
 * framework checkout instead, so the loop is edit, rebuild that package, and
 * reload the app.
 *
 * Symlinks in `node_modules`, not `file:` ranges in package.json, for two
 * reasons. A machine-local path in package.json is one `git add -p` away from
 * being committed and breaking everyone else's install, and bun caches a
 * `file:` dependency by version — the same version string after an edit
 * resolves to the stale copy, which is the exact confusion this is meant to
 * remove. A symlink is outside the lockfile, cannot be committed, and always
 * reads the current source.
 *
 * The app imports each package's build output, so a linked package still has
 * to be built (`cd <framework>/storage/framework/core/<pkg> && bun build.ts`).
 * The link is reported as stale rather than silently serving nothing when the
 * `dist` is missing.
 */

/** Where the linked set is recorded, so `unlink:core` knows what to undo. */
function recordPath(): string {
  return join(process.cwd(), 'storage/framework/runtime/linked-core.json')
}

interface LinkRecord {
  framework: string
  packages: string[]
}

function readRecord(): LinkRecord | null {
  try {
    return JSON.parse(fs.readFileSync(recordPath(), 'utf-8')) as LinkRecord
  }
  catch {
    return null
  }
}

function writeRecord(record: LinkRecord): void {
  fs.mkdirSync(join(process.cwd(), 'storage/framework/runtime'), { recursive: true })
  fs.writeFileSync(recordPath(), `${JSON.stringify(record, null, 2)}\n`)
}

/**
 * The framework checkout to link against.
 *
 * An explicit `--path` wins; then `STACKS_FRAMEWORK_PATH`, for anyone whose
 * checkout is not where the conventions expect; then the two conventional
 * places — a sibling of this project, and `~/Code/stacks`.
 */
function resolveFrameworkPath(explicit?: string): string | null {
  const candidates = [
    explicit,
    process.env.STACKS_FRAMEWORK_PATH,
    resolve(process.cwd(), '../stacks'),
    join(homedir(), 'Code/stacks'),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const full = resolve(candidate)
    if (existsSync(join(full, 'storage/framework/core')))
      return full
  }

  return null
}

/** Every core package in the checkout, by npm name. */
function corePackages(framework: string): Map<string, string> {
  const coreDir = join(framework, 'storage/framework/core')
  const found = new Map<string, string>()

  for (const entry of readdirSync(coreDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue

    const dir = join(coreDir, entry.name)
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest))
      continue

    try {
      const { name } = JSON.parse(fs.readFileSync(manifest, 'utf-8')) as { name?: string }
      if (name?.startsWith('@stacksjs/'))
        found.set(name, dir)
    }
    catch {
      // A package.json we cannot read is a package we cannot link.
    }
  }

  return found
}

/** Accepts `router`, `@stacksjs/router`, or `core/router`. */
function normalize(name: string): string {
  const short = name.replace(/^@stacksjs\//, '').replace(/^core\//, '')
  return `@stacksjs/${short}`
}

function isSymlink(path: string): boolean {
  try {
    return lstatSync(path).isSymbolicLink()
  }
  catch {
    return false
  }
}

export function link(buddy: CLI): void {
  buddy
    .command('link:core [...packages]', 'Point this app\'s @stacksjs/* at a local framework checkout')
    .option('--path <path>', 'Framework checkout to link against')
    .option('--all', 'Link every core package the app has installed', { default: false })
    .example('buddy link:core auth router')
    .example('buddy link:core --all --path ../stacks')
    .action(async (packages: string[] | undefined, options?: { path?: string, all?: boolean }) => {
      const framework = resolveFrameworkPath(options?.path)

      if (!framework) {
        log.error('No framework checkout found.')
        log.info('Pass one with `--path <dir>` or set STACKS_FRAMEWORK_PATH.')
        process.exit(ExitCode.FatalError)
      }

      const available = corePackages(framework)
      const modulesDir = join(process.cwd(), 'node_modules')

      const wanted = (packages?.length ?? 0) > 0
        ? packages!.map(normalize)
        // Default to what the app actually installed: linking a package the
        // app never depended on adds a resolution it did not have.
        : [...available.keys()].filter(name => existsSync(join(modulesDir, name)) || options?.all)

      if (wanted.length === 0) {
        log.info('Nothing to link: no installed @stacksjs/* packages found in this project.')
        await log.flush()
        process.exit(ExitCode.Success)
      }

      const linked: string[] = []
      const unbuilt: string[] = []

      for (const name of wanted) {
        const source = available.get(name)
        if (!source) {
          log.warn(`${name} is not in ${italic(framework)} — skipped.`)
          continue
        }

        const target = join(modulesDir, name)

        // Already pointing at this source: nothing to do, and re-linking
        // would delete and recreate the same link.
        if (isSymlink(target) && realpathSync(target) === realpathSync(source)) {
          linked.push(name)
          continue
        }

        fs.rmSync(target, { recursive: true, force: true })
        fs.mkdirSync(join(target, '..'), { recursive: true })
        fs.symlinkSync(source, target, 'dir')
        linked.push(name)

        if (!existsSync(join(source, 'dist')))
          unbuilt.push(name)
      }

      writeRecord({ framework, packages: linked })

      log.success(`Linked ${linked.length} package${linked.length === 1 ? '' : 's'} to ${italic(framework)}`)

      if (unbuilt.length > 0) {
        log.warn(`Not built yet: ${unbuilt.join(', ')}`)
        log.info('An app imports the build output, so each linked package needs `bun build.ts` in its directory.')
      }

      log.info('Undo with `buddy unlink:core`.')

      // The logger writes asynchronously, and process.exit does not wait for
      // it: without this the command reports nothing at all and looks like it
      // did nothing.
      await log.flush()
      process.exit(ExitCode.Success)
    })

  buddy
    .command('unlink:core [...packages]', 'Go back to the installed @stacksjs/* packages')
    .option('--all', 'Unlink everything that was linked', { default: false })
    .example('buddy unlink:core')
    .action(async (packages: string[] | undefined, _options?: { all?: boolean }) => {
      const record = readRecord()
      const modulesDir = join(process.cwd(), 'node_modules')

      const wanted = (packages?.length ?? 0) > 0
        ? packages!.map(normalize)
        // No record (a fresh clone, a cleaned storage/) is not a failure:
        // fall back to whatever in node_modules is actually a symlink.
        : record?.packages ?? readdirSync(join(modulesDir, '@stacksjs'), { withFileTypes: true })
          .filter(entry => entry.isSymbolicLink())
          .map(entry => `@stacksjs/${entry.name}`)

      let removed = 0
      for (const name of wanted) {
        const target = join(modulesDir, name)
        if (!isSymlink(target))
          continue

        fs.rmSync(target, { force: true })
        removed++
      }

      fs.rmSync(recordPath(), { force: true })

      if (removed === 0) {
        log.info('Nothing was linked.')
        await log.flush()
        process.exit(ExitCode.Success)
      }

      log.info(`Unlinked ${removed} package${removed === 1 ? '' : 's'}; reinstalling the published copies...`)

      const install = Bun.spawn(['bun', 'install', '--force'], { cwd: process.cwd(), stdout: 'inherit', stderr: 'inherit' })
      const code = await install.exited

      if (code !== 0) {
        log.error('`bun install` failed. The links are gone; re-run the install once the failure is resolved.')
        process.exit(ExitCode.FatalError)
      }

      log.success('This project is back on the published packages.')
      await log.flush()
      process.exit(ExitCode.Success)
    })
}
