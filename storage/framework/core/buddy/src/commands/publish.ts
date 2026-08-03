import type { CLI } from '@stacksjs/types'
import { existsSync, mkdirSync } from 'node:fs'
import { cp, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { italic, log, onUnknownSubcommand } from "@stacksjs/cli"
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

interface PublishOptions {
  force?: boolean
  verbose?: boolean
}

interface PublishCoreOptions extends PublishOptions {
  all?: boolean
  path?: string
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
    publishAll: 'Vendor the whole framework: copy storage/framework/core out of a local Stacks checkout and wire it up as a Bun workspace',
    frameworkPath: 'The Stacks checkout to vendor from (defaults to $STACKS_FRAMEWORK_PATH, ../stacks, then ~/Code/stacks)',
    coreStatus: 'Report whether this project runs on a vendored storage/framework/core or on the published packages',
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
    .command('publish:core [pkg]', descriptions.core)
    .option('--all', descriptions.publishAll, { default: false })
    .option('--path <path>', descriptions.frameworkPath)
    .option('--force', descriptions.force, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy publish:core router')
    .example('buddy publish:core --all')
    .example('buddy publish:core --all --path ../stacks')
    .action(async (pkg: string | undefined, options: PublishCoreOptions) => {
      if (options.all) {
        await vendorFramework(options.path, !!options.force)
        return
      }

      if (!pkg) {
        log.error('Usage: buddy publish:core <pkg>   (or --all to vendor the whole framework as a workspace)')
        process.exit(ExitCode.FatalError)
      }

      await publishCorePackage(pkg, !!options.force)
    })

  buddy
    .command('core:status', descriptions.coreStatus)
    .alias('publish:core:status')
    .option('--verbose', descriptions.verbose, { default: false })
    .example('buddy core:status')
    .action(async () => {
      await reportCoreStatus()
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
 * Move a project ONTO the vendored framework — the exact inverse of
 * `unpublish:core --all`, and the half of the round trip that was missing.
 *
 * `buddy new` leaves an app resolving every `@stacksjs/*` package from npm,
 * which is right for working WITH Stacks. Working ON Stacks from inside a real
 * app needs the opposite: the framework source in `storage/framework/core`,
 * wired up as a Bun workspace, so an edit is live in the app on the next
 * reload instead of after a release.
 *
 * The source has to be a Stacks checkout, not `node_modules`. Published
 * packages ship `dist` only — vendoring those would produce a directory of
 * build output that cannot be edited, which defeats the entire point.
 *
 * `link:core` solves a narrower version of this by symlinking individual
 * packages. Use that to try one package against an app; use this when the app
 * IS the development environment for the framework.
 */
async function vendorFramework(explicitPath: string | undefined, force: boolean): Promise<void> {
  const coreDir = path.frameworkPath('core')
  const rel = (p: string) => p.replace(`${process.cwd()}/`, '')

  if (existsSync(coreDir) && !force) {
    log.info(`Already vendored: ${italic(rel(coreDir))}`)
    log.info('Pass --force to replace it with a fresh copy of the checkout.')
    return
  }

  const framework = resolveFrameworkCheckout(explicitPath)
  if (!framework) {
    log.error('No Stacks checkout found to vendor from.')
    log.info('Pass one with `--path <dir>`, or set STACKS_FRAMEWORK_PATH.')
    log.info('A checkout is required: the published packages ship `dist` only, so a copy of them would not be editable.')
    process.exit(ExitCode.FatalError)
  }

  const sourceCore = join(framework, 'storage/framework/core')
  const corePkgPath = resolve(sourceCore, 'package.json')
  if (!existsSync(corePkgPath)) {
    log.error(`${sourceCore} has no package.json — that does not look like a Stacks checkout.`)
    process.exit(ExitCode.FatalError)
  }

  const corePkg = JSON.parse(await fs.promises.readFile(corePkgPath, 'utf-8')) as {
    name?: string
    version?: string
    dependencies?: Record<string, string>
  }
  const depName = corePkg.name ?? 'stacks'

  // 1. The source itself. `node_modules` is the checkout's own install tree —
  //    copying it would duplicate thousands of files that `bun install` is
  //    about to recreate here anyway. `dist` is NOT skipped: a workspace
  //    package resolves through its export map, which points at the build
  //    output, so a dist-less copy imports nothing.
  log.info(`Vendoring the framework from ${italic(framework)}...`)
  if (existsSync(coreDir))
    await fs.promises.rm(coreDir, { recursive: true, force: true })

  const SKIP = new Set(['node_modules', '.bun', '.cache', 'tsconfig.tsbuildinfo'])
  let copied = 0
  await copyTreeFiltered(sourceCore, coreDir, SKIP, () => copied++)

  // 2. package.json: the version range becomes a workspace link again, and the
  //    globs that make bun see the vendored packages come back. Both have to
  //    happen together — a `workspace:*` range with no matching glob fails the
  //    install outright.
  const rootPkgPath = resolve(process.cwd(), 'package.json')
  const rootPkg = JSON.parse(await fs.promises.readFile(rootPkgPath, 'utf-8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    workspaces?: string[]
  }

  const provided = new Set<string>([depName])
  for (const entry of await readdir(coreDir, { withFileTypes: true })) {
    if (!entry.isDirectory())
      continue

    // Only names that are really packages: `core/` also holds plain
    // directories (dist, codebase) that no dependency ever refers to.
    if (existsSync(resolve(coreDir, entry.name, 'package.json')))
      provided.add(`@stacksjs/${entry.name}`)
  }

  let repointed = 0
  for (const field of ['dependencies', 'devDependencies'] as const) {
    const deps = rootPkg[field]
    if (!deps)
      continue

    for (const name of Object.keys(deps)) {
      if (!provided.has(name) || deps[name]!.startsWith('workspace:'))
        continue

      deps[name] = 'workspace:*'
      repointed++
    }
  }

  if (!rootPkg.dependencies?.[depName] && !rootPkg.devDependencies?.[depName])
    rootPkg.dependencies = { ...rootPkg.dependencies, [depName]: 'workspace:*' }

  const workspaces = rootPkg.workspaces ?? []
  let addedGlobs = 0
  for (const glob of ['storage/framework/core', 'storage/framework/core/*']) {
    if (workspaces.some(existing => existing.replace(/^\.\//, '').replace(/\/$/, '') === glob))
      continue

    workspaces.push(glob)
    addedGlobs++
  }
  rootPkg.workspaces = workspaces

  await fs.promises.writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`)

  // 3. bunfig.toml preloads. `@stacksjs/env/plugin.js` and
  //    `storage/framework/core/env/plugin.ts` are the same module; in a
  //    vendored layout the source is what should load, so an edit to it takes
  //    effect without a rebuild of that package.
  const bunfigPath = resolve(process.cwd(), 'bunfig.toml')
  let rewrittenPreloads = 0
  if (existsSync(bunfigPath)) {
    const bunfig = await fs.promises.readFile(bunfigPath, 'utf-8')
    const next = bunfig.replace(
      /(["'])@stacksjs\/([\w-]+)\/([^"']+?)\.js\1/g,
      (match, quote: string, pkgName: string, subpath: string) => {
        // Only rewrite preloads we actually vendored; an unrelated package
        // specifier elsewhere in the file is none of our business.
        if (!provided.has(`@stacksjs/${pkgName}`))
          return match

        rewrittenPreloads++
        return `${quote}./storage/framework/core/${pkgName}/${subpath}.ts${quote}`
      },
    )

    if (next !== bunfig)
      await fs.promises.writeFile(bunfigPath, next)
  }

  // 4. tsconfig. The package layout inherits from
  //    `storage/framework/tsconfig.app.json` (synced out of @stacksjs/defaults);
  //    the vendored layout inherits from the checkout's own core config, which
  //    maps `@stacksjs/*` at source rather than at the installed `.d.ts`.
  const tsconfigPath = resolve(process.cwd(), 'tsconfig.json')
  let rewroteTsconfig = false
  if (existsSync(tsconfigPath)) {
    const raw = await fs.promises.readFile(tsconfigPath, 'utf-8')
    const next = raw.replace(
      /"extends"\s*:\s*"\.\/storage\/framework\/tsconfig\.app\.json"/,
      '"extends": "./storage/framework/core/tsconfig.json"',
    )

    if (next !== raw) {
      await fs.promises.writeFile(tsconfigPath, next)
      rewroteTsconfig = true
    }
  }

  log.success(`Vendored ${copied} files into ${italic(rel(coreDir))}`)
  log.info(`package.json now depends on ${depName}@workspace:*`)
  if (repointed > 0)
    log.info(`Repointed ${repointed} version range${repointed === 1 ? '' : 's'} to workspace:*`)
  if (addedGlobs > 0)
    log.info(`Added ${addedGlobs} workspace glob${addedGlobs === 1 ? '' : 's'} for the vendored packages`)
  if (rewrittenPreloads > 0)
    log.info(`Rewrote ${rewrittenPreloads} bunfig.toml preload path${rewrittenPreloads === 1 ? '' : 's'} to the vendored source`)
  if (rewroteTsconfig)
    log.info('tsconfig.json now extends storage/framework/core/tsconfig.json')

  log.info('Linking the workspace...')
  const install = Bun.spawn(['bun', 'install'], { cwd: process.cwd(), stdout: 'inherit', stderr: 'inherit' })
  const code = await install.exited
  if (code !== 0) {
    log.error('`bun install` failed. The files are in place; re-run the install once the failure is resolved.')
    process.exit(ExitCode.FatalError)
  }

  log.success('This project now runs on the vendored framework — edits under storage/framework/core are live.')
  log.info('Go back to the published packages any time with `buddy unpublish:core --all`.')
}

/**
 * The Stacks checkout to vendor from. An explicit `--path` wins, then
 * `STACKS_FRAMEWORK_PATH`, then the two conventional locations. Matches the
 * resolution order `link:core` uses so both commands find the same checkout.
 */
function resolveFrameworkCheckout(explicit?: string): string | null {
  const candidates = [
    explicit,
    process.env.STACKS_FRAMEWORK_PATH,
    resolve(process.cwd(), '../stacks'),
    join(homedir(), 'Code/stacks'),
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const full = resolve(candidate)

    // Never vendor a project into itself: `../stacks` resolves to the checkout
    // itself when the command is run from one, and the copy would be a no-op
    // that still rewrites package.json into a self-referencing workspace.
    if (full === resolve(process.cwd()))
      continue

    if (existsSync(join(full, 'storage/framework/core/package.json')))
      return full
  }

  return null
}

/**
 * Which layout is this project on? Both are supported everywhere, which is
 * exactly why it is easy to lose track — a stale `storage/framework/core` and
 * an installed `stacks` disagree silently, and the answer decides whether an
 * edit under `storage/framework/core` does anything at all.
 */
async function reportCoreStatus(): Promise<void> {
  const coreDir = path.frameworkPath('core')
  const rel = (p: string) => p.replace(`${process.cwd()}/`, '')
  const vendored = existsSync(resolve(coreDir, 'package.json'))

  const rootPkgPath = resolve(process.cwd(), 'package.json')
  const rootPkg = existsSync(rootPkgPath)
    ? JSON.parse(await fs.promises.readFile(rootPkgPath, 'utf-8')) as {
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
      workspaces?: string[]
    }
    : {}

  const declared = rootPkg.dependencies?.stacks ?? rootPkg.devDependencies?.stacks

  if (vendored) {
    const corePkg = JSON.parse(await fs.promises.readFile(resolve(coreDir, 'package.json'), 'utf-8')) as { version?: string }
    const packages = (await readdir(coreDir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && existsSync(resolve(coreDir, entry.name, 'package.json')))

    log.info(`Layout:  vendored — ${italic(rel(coreDir))} (${packages.length} packages, v${corePkg.version ?? 'unknown'})`)
    log.info(`Declared: stacks@${declared ?? '(not declared)'}`)

    // A vendored directory that nothing links to is the failure mode worth
    // naming: edits land in files no import ever reaches.
    if (declared && !declared.startsWith('workspace:'))
      log.warn(`The vendored copy is not linked: stacks is declared as ${declared}, not workspace:*. Run \`buddy publish:core --all --force\` to relink, or \`buddy unpublish:core --all\` to remove it.`)

    log.info('Move to the published packages with `buddy unpublish:core --all`.')
    return
  }

  const installed = resolve(process.cwd(), 'node_modules/@stacksjs/buddy/package.json')
  const installedVersion = existsSync(installed)
    ? (JSON.parse(await fs.promises.readFile(installed, 'utf-8')) as { version?: string }).version
    : undefined

  log.info('Layout:  published packages — no storage/framework/core in this project')
  log.info(`Declared: stacks@${declared ?? '(not declared)'}`)
  log.info(`Installed: ${installedVersion ? `v${installedVersion}` : '(run bun install)'}`)
  log.info('Vendor the framework for local development with `buddy publish:core --all`.')
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

  const corePkg = JSON.parse(await fs.promises.readFile(corePkgPath, 'utf-8')) as {
    name?: string
    version?: string
    dependencies?: Record<string, string>
  }
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
    scripts?: Record<string, string>
    workspaces?: string[]
  }

  const depName = corePkg.name ?? 'stacks'
  const range = `^${version}`

  // Everything the vendored workspace was providing. Any `workspace:` range on
  // one of these names has to become a version range, wherever it is declared:
  // once the directory is gone bun fails the whole install with
  // `Workspace dependency "<name>" not found` rather than falling back to npm.
  const provided = new Set<string>([depName, ...Object.keys(corePkg.dependencies ?? {}).filter(name => name.startsWith('@stacksjs/'))])
  for (const entry of await readdir(coreDir, { withFileTypes: true })) {
    if (entry.isDirectory())
      provided.add(`@stacksjs/${entry.name}`)
  }

  let repointed = 0
  const repointWorkspaceRanges = (pkg: { dependencies?: Record<string, string>, devDependencies?: Record<string, string>, peerDependencies?: Record<string, string> }): boolean => {
    let touched = false
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies'] as const) {
      const deps = pkg[field]
      if (!deps)
        continue

      for (const [name, spec] of Object.entries(deps)) {
        if (!spec.startsWith('workspace:') || !provided.has(name))
          continue

        deps[name] = range
        touched = true
        repointed++
      }
    }
    return touched
  }

  repointWorkspaceRanges(rootPkg)

  // The app has to declare the framework itself, or nothing pulls it in.
  if (!rootPkg.dependencies?.[depName] && !rootPkg.devDependencies?.[depName])
    rootPkg.dependencies = { ...rootPkg.dependencies, [depName]: range }

  // Scripts that run the vendored CLI by path (`bun
  // ./storage/framework/core/buddy/src/cli.ts lint`) point at a file that is
  // about to stop existing. The `./buddy` shim resolves whichever CLI the
  // project actually has, so it is right in both layouts — and a script like
  // `bun buddy lint` in CI fails hard otherwise, days after the unvendor.
  let rewrittenScripts = 0
  for (const [name, script] of Object.entries(rootPkg.scripts ?? {})) {
    if (!/storage\/framework\/core\/buddy\/src\/cli\.ts/.test(script))
      continue

    rootPkg.scripts![name] = script.replace(
      /\bbunx?\s+(?:--bun\s+)?\.?\/?storage\/framework\/core\/buddy\/src\/cli\.ts/g,
      './buddy',
    )
    rewrittenScripts++
  }

  if (Array.isArray(rootPkg.workspaces)) {
    rootPkg.workspaces = rootPkg.workspaces.filter(glob => !isCoreWorkspaceGlob(glob))
    if (rootPkg.workspaces.length === 0)
      delete rootPkg.workspaces
  }

  await fs.promises.writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`)

  // The workspace members that survive (libs, views, the framework package
  // itself) commonly depend on the framework with `workspace:*` too.
  for (const glob of rootPkg.workspaces ?? []) {
    for (const memberPkgPath of globSync(`${glob.replace(/\/$/, '')}/package.json`, { cwd: process.cwd(), absolute: true })) {
      const raw = await fs.promises.readFile(memberPkgPath, 'utf-8')
      const memberPkg = JSON.parse(raw)
      if (repointWorkspaceRanges(memberPkg))
        await fs.promises.writeFile(memberPkgPath, `${JSON.stringify(memberPkg, null, 2)}\n`)
    }
  }

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

  // 3. tsconfig.json inherits from the vendored core config, which is about to
  //    stop existing — and a missing `extends` target is a hard tsc error, so
  //    `bun run typecheck` breaks days later with nothing pointing back here.
  //    `storage/framework/tsconfig.app.json` is the package-layout equivalent,
  //    synced out of @stacksjs/defaults by `buddy upgrade`.
  const tsconfigPath = resolve(process.cwd(), 'tsconfig.json')
  let rewroteTsconfig = false
  if (existsSync(tsconfigPath)) {
    const raw = await fs.promises.readFile(tsconfigPath, 'utf-8')
    const next = raw.replace(
      /"extends"\s*:\s*"\.\/storage\/framework\/core\/tsconfig\.json"/,
      '"extends": "./storage/framework/tsconfig.app.json"',
    )

    if (next !== raw) {
      await fs.promises.writeFile(tsconfigPath, next)
      rewroteTsconfig = true
    }
  }

  // 4. The vendored source itself, and any node_modules symlink still
  //    pointing into it. Those links survive the directory they point at and
  //    then resolve to nothing, so an import of that package fails with a
  //    missing module rather than falling back to the published copy.
  await fs.promises.rm(coreDir, { recursive: true, force: true })

  const scopedDir = resolve(process.cwd(), 'node_modules/@stacksjs')
  let danglingRemoved = 0
  if (existsSync(scopedDir)) {
    for (const entry of await readdir(scopedDir, { withFileTypes: true })) {
      if (!entry.isSymbolicLink())
        continue

      const link = resolve(scopedDir, entry.name)
      if (existsSync(link))
        continue

      await fs.promises.rm(link, { force: true })
      danglingRemoved++
    }
  }

  log.success(`Removed ${italic(rel(coreDir))}`)
  log.info(`package.json now depends on ${depName}@${range}`)
  if (repointed > 0)
    log.info(`Repointed ${repointed} workspace: range${repointed === 1 ? '' : 's'} to ${range}`)
  if (danglingRemoved > 0)
    log.info(`Removed ${danglingRemoved} node_modules symlink${danglingRemoved === 1 ? '' : 's'} left pointing into it`)
  if (rewrittenScripts > 0)
    log.info(`Repointed ${rewrittenScripts} package.json script${rewrittenScripts === 1 ? '' : 's'} to ./buddy`)
  if (rewrittenPreloads > 0)
    log.info(`Rewrote ${rewrittenPreloads} bunfig.toml preload path${rewrittenPreloads === 1 ? '' : 's'} to package specifiers`)
  if (rewroteTsconfig)
    log.info('tsconfig.json now extends storage/framework/tsconfig.app.json')

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
