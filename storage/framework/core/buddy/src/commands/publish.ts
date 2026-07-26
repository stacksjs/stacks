import type { CLI } from '@stacksjs/types'
import { existsSync, mkdirSync } from 'node:fs'
import { cp, readdir, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { italic, log, onUnknownSubcommand } from "@stacksjs/cli"
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

interface PublishOptions {
  force?: boolean
  verbose?: boolean
}

interface UnpublishOptions extends PublishOptions {
  all?: boolean
}

export function publish(buddy: CLI): void {
  const descriptions = {
    command: 'Publish a Stacks default into your userland (app/) directory so you can customize it',
    model: 'Publish a default model from storage/framework/defaults/app/Models/ to app/Models/',
    controller: 'Publish a default controller from storage/framework/defaults/app/Controllers/ to app/Controllers/',
    middleware: 'Publish a default middleware from storage/framework/defaults/app/Middleware/ to app/Middleware/',
    action: 'Publish a default action from storage/framework/defaults/app/Actions/ to app/Actions/',
    core: 'Publish a framework package source from node_modules/@stacksjs/<pkg>/ into storage/framework/core/<pkg>/ for editing',
    unpublishCore: 'Drop a vendored storage/framework/core/<pkg>/ and go back to the installed @stacksjs/<pkg>',
    all: 'Unvendor the whole framework: remove storage/framework/core and resolve every @stacksjs package from the `stacks` dependency in package.json',
    name: 'The name of the resource to publish (e.g. Cart, User)',
    pkg: 'The name of the framework package (e.g. router, orm, faker — without @stacksjs/ prefix)',
    force: 'Overwrite an existing userland file',
    forceUnpublish: 'Delete the vendored source even when it has uncommitted changes',
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
    .command('publish:action <name>', descriptions.action)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (name: string, options: PublishOptions) => {
      await publishResource({
        kind: 'action',
        name,
        defaultsDir: path.frameworkPath('defaults/app/Actions'),
        userDir: path.userActionsPath(),
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
    .command('unpublish:core [pkg]', descriptions.unpublishCore)
    .option('--all', descriptions.all, { default: false })
    .option('--force', descriptions.forceUnpublish, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (pkg: string | undefined, options: UnpublishOptions) => {
      if (options.all) {
        await unvendorFramework(!!options.force)
        return
      }

      if (!pkg) {
        log.error('Usage: buddy unpublish:core <pkg>   (or --all to move the whole framework to node_modules)')
        process.exit(ExitCode.FatalError)
      }

      await unpublishCorePackage(pkg, !!options.force)
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
        action: () => publishResource({
          kind: 'action',
          name,
          defaultsDir: path.frameworkPath('defaults/app/Actions'),
          userDir: path.userActionsPath(),
          force: !!options.force,
        }),
        core: () => publishCorePackage(name, !!options.force),
      }

      const handler = dispatch[resource.toLowerCase()]

      if (!handler) {
        log.error(`Unknown publishable resource: ${italic(resource)}`)
        log.info('Available: model, controller, middleware, action, core')
        process.exit(ExitCode.FatalError)
      }

      await handler()
    })

  onUnknownSubcommand(buddy, "publish")
}

interface PublishContext {
  kind: 'model' | 'controller' | 'middleware' | 'action'
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
  if (!sourcePath)
    throw new Error(`Could not resolve default ${kind}: ${fileName}`)
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

/**
 * Remove one vendored core package so the project resolves the installed
 * `@stacksjs/<pkg>` again. The exact inverse of `publish:core <pkg>`.
 */
async function unpublishCorePackage(pkg: string, force: boolean): Promise<void> {
  const shortName = normalizeCoreName(pkg)
  const targetDir = path.frameworkPath(`core/${shortName}`)
  const rel = (p: string) => p.replace(`${process.cwd()}/`, '')

  if (!existsSync(targetDir)) {
    log.info(`Not vendored: ${italic(rel(targetDir))} — nothing to do.`)
    return
  }

  // Removing the override is only safe if something is left to resolve. An
  // app that vendored a package and never installed it would simply lose it.
  const installed = resolve(process.cwd(), 'node_modules', '@stacksjs', shortName)
  if (!existsSync(installed) && !force) {
    log.error(`@stacksjs/${shortName} is not installed, so removing the vendored copy would leave nothing to resolve.`)
    log.info(`Run \`bun add @stacksjs/${shortName}\` first, or pass --force to remove it anyway.`)
    process.exit(ExitCode.FatalError)
  }

  await assertNoUncommittedChanges(targetDir, force)

  await fs.promises.rm(targetDir, { recursive: true, force: true })

  log.success(`Unpublished ${italic(rel(targetDir))} — @stacksjs/${shortName} now resolves from node_modules.`)
}

/**
 * Move a project off the vendored framework entirely.
 *
 * A `buddy new` scaffold ships the whole framework source under
 * `storage/framework/core` and wires it up as a Bun workspace. That layout is
 * for working ON Stacks. An app that only works WITH Stacks wants the same
 * packages from npm, which is what the single `stacks` dependency in
 * package.json pulls in — it depends on every `@stacksjs/*` package at a
 * matching version.
 *
 * Both layouts are supported everywhere (the `buddy` launcher, `runAction`,
 * and the alias map all fall back from vendored source to the installed
 * package), so this is purely a matter of rewriting the three places that
 * point AT the vendored copy, then deleting it.
 */
async function unvendorFramework(force: boolean): Promise<void> {
  const coreDir = path.frameworkPath('core')
  const rel = (p: string) => p.replace(`${process.cwd()}/`, '')

  if (!existsSync(coreDir)) {
    log.info('No storage/framework/core in this project — already on the installed packages.')
    return
  }

  const corePkgPath = resolve(coreDir, 'package.json')
  if (!existsSync(corePkgPath)) {
    log.error(`${rel(coreDir)} has no package.json, so its version cannot be determined.`)
    log.info('Unvendor the packages individually with `buddy unpublish:core <pkg>` instead.')
    process.exit(ExitCode.FatalError)
  }

  const corePkg = JSON.parse(await fs.promises.readFile(corePkgPath, 'utf-8')) as { name?: string, version?: string }
  const version = corePkg.version
  if (!version) {
    log.error(`${rel(corePkgPath)} has no version field.`)
    process.exit(ExitCode.FatalError)
  }

  await assertNoUncommittedChanges(coreDir, force)

  // 1. package.json: the workspace link becomes a version range, and the
  //    workspace globs that point into core stop matching anything real.
  const rootPkgPath = resolve(process.cwd(), 'package.json')
  const rootPkgRaw = await fs.promises.readFile(rootPkgPath, 'utf-8')
  const rootPkg = JSON.parse(rootPkgRaw) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    workspaces?: string[]
  }

  const depName = corePkg.name ?? 'stacks'
  const range = `^${version}`
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = rootPkg[field]
    if (deps?.[depName]?.startsWith('workspace:'))
      deps[depName] = range
  }

  // Nothing else may declare the dependency, or bun keeps linking the
  // directory that is about to be deleted.
  if (!rootPkg.dependencies?.[depName] && !rootPkg.devDependencies?.[depName]) {
    rootPkg.dependencies = { ...rootPkg.dependencies, [depName]: range }
  }

  if (Array.isArray(rootPkg.workspaces)) {
    rootPkg.workspaces = rootPkg.workspaces.filter(glob => !isCoreWorkspaceGlob(glob))
    if (rootPkg.workspaces.length === 0)
      delete rootPkg.workspaces
  }

  await fs.promises.writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`)

  // 2. bunfig.toml preloads point at source files inside core. Rewrite them to
  //    package specifiers: `storage/framework/core/env/plugin.ts` is the same
  //    module as `@stacksjs/env/plugin.js`, which the package's `./*` export
  //    maps onto its build output.
  const bunfigPath = resolve(process.cwd(), 'bunfig.toml')
  let rewrittenPreloads = 0
  if (existsSync(bunfigPath)) {
    const bunfig = await fs.promises.readFile(bunfigPath, 'utf-8')
    const next = bunfig.replace(
      /(["'])\.?\/?storage\/framework\/core\/([\w-]+)\/([^"']+?)\.ts\1/g,
      (_match, quote: string, pkgName: string, subpath: string) => {
        rewrittenPreloads++
        return `${quote}@stacksjs/${pkgName}/${subpath}.js${quote}`
      },
    )

    if (next !== bunfig)
      await fs.promises.writeFile(bunfigPath, next)
  }

  // 3. The vendored source itself.
  await fs.promises.rm(coreDir, { recursive: true, force: true })

  log.success(`Removed ${italic(rel(coreDir))}`)
  log.info(`package.json now depends on ${depName}@${range}`)
  if (rewrittenPreloads > 0)
    log.info(`Rewrote ${rewrittenPreloads} bunfig.toml preload path${rewrittenPreloads === 1 ? '' : 's'} to package specifiers`)

  log.info('Installing the published packages...')
  const install = Bun.spawn(['bun', 'install'], { cwd: process.cwd(), stdout: 'inherit', stderr: 'inherit' })
  const code = await install.exited
  if (code !== 0) {
    log.error('`bun install` failed. package.json and bunfig.toml were updated; re-run the install once the failure is resolved.')
    process.exit(ExitCode.FatalError)
  }

  log.success('This project now runs on the published Stacks packages.')
  log.info('Vendor an individual package again any time with `buddy publish:core <pkg>`.')
}

/** Accepts `router`, `@stacksjs/router`, or `core/router`. */
function normalizeCoreName(pkg: string): string {
  const shortName = pkg.replace(/^@stacksjs\//, '').replace(/^core\//, '')

  if (!shortName || shortName.includes('/') || shortName.includes('..')) {
    process.stderr.write(`Invalid package name: ${pkg}\n`)
    process.stderr.write('  Use a short name like `router` or the fully qualified `@stacksjs/router`.\n')
    process.exit(ExitCode.FatalError)
  }

  return shortName
}

/** True for the workspace globs that only ever match vendored core packages. */
function isCoreWorkspaceGlob(glob: string): boolean {
  const normalized = glob.replace(/^\.\//, '').replace(/\/$/, '')
  return normalized === 'storage/framework/core' || normalized.startsWith('storage/framework/core/')
}

/**
 * Refuse to delete vendored source that carries edits which exist nowhere
 * else. Vendoring exists so the framework CAN be edited in place, so a
 * `git status` on the directory is the difference between "removing a copy"
 * and "losing work".
 */
async function assertNoUncommittedChanges(dir: string, force: boolean): Promise<void> {
  if (force)
    return

  try {
    const proc = Bun.spawn(['git', 'status', '--porcelain', '--', dir], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'ignore',
    })
    const output = await new Response(proc.stdout).text()
    if (await proc.exited !== 0)
      return // not a git repo, or git is unavailable: nothing to compare against

    const changed = output.split('\n').filter(Boolean)
    if (changed.length === 0)
      return

    log.error(`${changed.length} uncommitted change${changed.length === 1 ? '' : 's'} under ${italic(dir.replace(`${process.cwd()}/`, ''))}:`)
    for (const line of changed.slice(0, 10)) log.info(`  ${line}`)
    if (changed.length > 10) log.info(`  ... and ${changed.length - 10} more`)
    log.info('Commit or stash them first, or pass --force to delete them anyway.')
    process.exit(ExitCode.FatalError)
  }
  catch {
    // git unavailable — proceed, the caller opted into this.
  }
}
