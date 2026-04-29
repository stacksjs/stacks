import type { CLI } from '@stacksjs/types'
import { existsSync, mkdirSync } from 'node:fs'
import { cp, readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { italic, log } from '@stacksjs/cli'
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

interface PublishOptions {
  force?: boolean
  verbose?: boolean
}

export function publish(buddy: CLI): void {
  const descriptions = {
    command: 'Publish a Stacks default into your userland (app/) directory so you can customize it',
    model: 'Publish a default model from storage/framework/defaults/app/Models/ to app/Models/',
    controller: 'Publish a default controller from storage/framework/defaults/app/Controllers/ to app/Controllers/',
    middleware: 'Publish a default middleware from storage/framework/defaults/app/Middleware/ to app/Middleware/',
    core: 'Publish a framework package source from node_modules/@stacksjs/<pkg>/ into storage/framework/core/<pkg>/ for editing',
    name: 'The name of the resource to publish (e.g. Cart, User)',
    pkg: 'The name of the framework package (e.g. router, orm, faker — without @stacksjs/ prefix)',
    force: 'Overwrite an existing userland file',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('publish:model <name>', descriptions.model)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (name: string, options: PublishOptions) => {
      await publishResource({
        kind: 'model',
        name,
        defaultsDir: path.frameworkPath('defaults/app/Models'),
        userDir: path.userModelsPath(),
        force: !!options.force,
      })
    })

  buddy
    .command('publish:controller <name>', descriptions.controller)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (name: string, options: PublishOptions) => {
      await publishResource({
        kind: 'controller',
        name,
        defaultsDir: path.frameworkPath('defaults/app/Controllers'),
        userDir: path.userControllersPath(),
        force: !!options.force,
      })
    })

  buddy
    .command('publish:middleware <name>', descriptions.middleware)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (name: string, options: PublishOptions) => {
      await publishResource({
        kind: 'middleware',
        name,
        defaultsDir: path.frameworkPath('defaults/app/Middleware'),
        userDir: path.userMiddlewarePath(),
        force: !!options.force,
      })
    })

  buddy
    .command('publish:core <pkg>', descriptions.core)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (pkg: string, options: PublishOptions) => {
      await publishCorePackage(pkg, !!options.force)
    })

  buddy
    .command('publish [resource] [name]', descriptions.command)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (resource: string | undefined, name: string | undefined, options: PublishOptions) => {
      if (!resource || !name) {
        log.error('Usage: buddy publish:<resource> <Name>  (e.g. buddy publish:model Cart)')
        process.exit(ExitCode.FatalError)
      }

      const dispatch: Record<string, () => Promise<void>> = {
        model: () => publishResource({
          kind: 'model',
          name,
          defaultsDir: path.frameworkPath('defaults/app/Models'),
          userDir: path.userModelsPath(),
          force: !!options.force,
        }),
        controller: () => publishResource({
          kind: 'controller',
          name,
          defaultsDir: path.frameworkPath('defaults/app/Controllers'),
          userDir: path.userControllersPath(),
          force: !!options.force,
        }),
        middleware: () => publishResource({
          kind: 'middleware',
          name,
          defaultsDir: path.frameworkPath('defaults/app/Middleware'),
          userDir: path.userMiddlewarePath(),
          force: !!options.force,
        }),
        core: () => publishCorePackage(name, !!options.force),
      }

      const handler = dispatch[resource.toLowerCase()]

      if (!handler) {
        log.error(`Unknown publishable resource: ${italic(resource)}`)
        log.info('Available: model, controller, middleware, core')
        process.exit(ExitCode.FatalError)
      }

      await handler()
    })

  buddy.on('publish:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

interface PublishContext {
  kind: 'model' | 'controller' | 'middleware'
  name: string
  defaultsDir: string
  userDir: string
  force: boolean
}

/**
 * Publish a framework package's source into `storage/framework/core/<pkg>/`
 * so the user can edit it. Mirrors the pattern of `publish:model`: copy the
 * canonical default into userland, then let local edits take precedence at
 * runtime (the action runner / module resolver checks the framework dir
 * before falling through to `node_modules`).
 *
 * Source is preferred over dist so the published copy is editable. We
 * exclude `node_modules` and `dist` from the copy to keep the userland
 * footprint small — they get rebuilt on demand.
 */
async function publishCorePackage(pkg: string, force: boolean): Promise<void> {
  // Normalize: accept `router`, `@stacksjs/router`, or `core/router`.
  const shortName = pkg
    .replace(/^@stacksjs\//, '')
    .replace(/^core\//, '')

  // Use process.stderr.write directly for error paths: the framework logger
  // is buffered and may not flush before `process.exit`, causing the user
  // to see an empty terminal instead of the actionable message.
  const fail = (msg: string, hint?: string): never => {
    process.stderr.write(`${msg}\n`)
    if (hint) process.stderr.write(`  ${hint}\n`)
    process.exit(ExitCode.FatalError)
  }

  if (!shortName || shortName.includes('/') || shortName.includes('..')) {
    fail(
      `Invalid package name: ${pkg}`,
      'Use a short name like `router` or the fully qualified `@stacksjs/router`.',
    )
  }

  const sourceDir = resolve(process.cwd(), 'node_modules', '@stacksjs', shortName)
  const targetDir = path.frameworkPath(`core/${shortName}`)

  // Verify the source exists and is a directory (symlink or real).
  try {
    const info = await stat(sourceDir)
    if (!info.isDirectory()) {
      fail(`${sourceDir} is not a directory.`)
    }
  }
  catch {
    fail(
      `Could not find @stacksjs/${shortName} in node_modules.`,
      'Run `bun install` first, or check the package name.',
    )
  }

  // Refuse to clobber an existing override unless --force was passed —
  // protects in-progress edits the user hasn't committed yet.
  if (existsSync(targetDir) && !force) {
    fail(
      `Already published: ${targetDir.replace(`${process.cwd()}/`, '')}`,
      'Pass --force to overwrite.',
    )
  }

  // Copy the package, skipping anything regenerable. `node_modules` would
  // duplicate the entire dependency tree (slow + huge); `dist` is a build
  // artifact — `bun install` + a build step rebuild both.
  mkdirSync(dirname(targetDir), { recursive: true })

  const SKIP = new Set(['node_modules', 'dist', '.bun', '.cache', 'tsconfig.tsbuildinfo'])
  let copied = 0
  await copyTreeFiltered(sourceDir, targetDir, SKIP, () => copied++)

  log.success(`Published @stacksjs/${shortName} → ${italic(targetDir.replace(`${process.cwd()}/`, ''))} (${copied} files)`)
  log.info('Edit freely — local changes win over the installed package.')
}

/**
 * Recursive copy that skips the entries in `skip` at every depth. Resolves
 * symlinks to their targets so a workspace-linked package gets a real copy
 * (otherwise the "override" would just be a pointer back into node_modules).
 */
async function copyTreeFiltered(
  sourceDir: string,
  targetDir: string,
  skip: Set<string>,
  onFile: () => void,
): Promise<void> {
  // dereference: true makes symlinked source files materialize as real files in the target
  // recursive: true is fast (uses fs.cp under the hood) but we need filtering, so we walk manually.
  mkdirSync(targetDir, { recursive: true })
  const entries = await readdir(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    if (skip.has(entry.name)) continue
    const src = `${sourceDir}/${entry.name}`
    const dst = `${targetDir}/${entry.name}`
    if (entry.isDirectory()) {
      await copyTreeFiltered(src, dst, skip, onFile)
      continue
    }
    // Files (and symlinks to files) get materialized.
    await cp(src, dst, { force: true, dereference: true })
    onFile()
  }
}

async function publishResource(ctx: PublishContext): Promise<void> {
  const { kind, name, defaultsDir, userDir, force } = ctx
  const fileName = name.endsWith('.ts') ? name : `${name}.ts`

  // Locate the default — search recursively so namespaced subdirs (e.g. commerce/) resolve.
  const matches = globSync([`${defaultsDir}/**/${fileName}`], { absolute: true })

  if (!matches.length) {
    log.error(`Could not find default ${kind}: ${italic(fileName)}`)
    log.info(`Looked under: ${italic(defaultsDir)}`)
    process.exit(ExitCode.FatalError)
  }

  if (matches.length > 1) {
    log.warn(`Multiple defaults match ${italic(fileName)}; using the first:`)
    for (const m of matches) log.info(`  ${m}`)
  }

  const sourcePath = matches[0]
  const targetPath = `${userDir.replace(/\/$/, '')}/${fileName}`

  if (existsSync(targetPath) && !force) {
    log.error(`Already exists: ${italic(targetPath)}`)
    log.info('Pass --force to overwrite.')
    process.exit(ExitCode.FatalError)
  }

  mkdirSync(dirname(targetPath), { recursive: true })

  await fs.promises.copyFile(sourcePath, targetPath)

  log.success(`Published ${kind} ${italic(name)} → ${italic(targetPath.replace(`${process.cwd()}/`, ''))}`)
}
