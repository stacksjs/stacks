import type { CLI } from '@stacksjs/types'
import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { cp, readdir, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { italic, log, onUnknownSubcommand } from "@stacksjs/cli"
import { path } from '@stacksjs/path'
import { fs, globSync } from '@stacksjs/storage'
import { pruneVendoredCoreFromWorkflows, splitFrameworkTypecheckScript } from '../workflow-prune'
import { detectInstaller, findCoreReferences, isDanglingLink, rewriteCoreCommandPaths, rewriteCoreSourceImports, rewriteSurvivingFrameworkManifests } from '../unvendor-rewrite'
import { fetchPublishedVersions } from '../registry'
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
    pkg: 'The name of the framework package (e.g. router, orm, faker - without @stacksjs/ prefix)',
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
        await log.error('Usage: buddy publish:core <pkg>   (or --all to vendor the whole framework as a workspace)')
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
        await log.error('Usage: buddy unpublish:core <pkg>   (or --all to move the whole framework to node_modules)')
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
        await log.error('Usage: buddy publish:<resource> <Name>  (e.g. buddy publish:model Cart)')
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
        await log.error(`Unknown publishable resource: ${italic(resource)}`)
        log.info('Available: model, controller, middleware, action, core')
        await log.flush()
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
  log.info('Edit freely - local changes win over the installed package.')
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
    await log.error(`Could not find default ${kind}: ${italic(fileName)}`)
    log.info(`Looked under: ${italic(defaultsDir)}`)
    await log.flush()
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
    await log.error(`Already exists: ${italic(targetPath)}`)
    log.info('Pass --force to overwrite.')
    await log.flush()
    process.exit(ExitCode.FatalError)
  }

  mkdirSync(dirname(targetPath), { recursive: true })

  await fs.promises.copyFile(sourcePath, targetPath)

  const carried = await carryRelativeImports(sourcePath, targetPath)

  log.success(`Published ${kind} ${italic(name)} → ${italic(targetPath.replace(`${process.cwd()}/`, ''))}`)
  for (const file of carried)
    log.info(`  + ${italic(file.replace(`${process.cwd()}/`, ''))} (imported by it)`)
}

/**
 * Copy the modules a published file imports by relative path.
 *
 * A plain copyFile publishes a file that does not run. `publish:model User`
 * lands a model importing `../password-policy`, which resolves inside
 * `storage/framework/defaults/app/` and nowhere else - so the app gets
 * `app/Models/User.ts` and no `app/password-policy.ts`, the import throws, and
 * the ORM quietly falls back to the framework default. The published override
 * is then inert: edits to it do nothing, and `buddy generate:migrations` fails
 * with a module-resolution error rather than anything about models.
 *
 * The relative offset is preserved, so `../password-policy` from
 * `Models/User.ts` lands at `app/password-policy.ts` and resolves again. That
 * is also what the policy file itself documents as the intent: an app that
 * wants a different rule edits its own copy.
 *
 * Recurses, so a dependency's own siblings come too, and refuses to write
 * outside the project root.
 */
export async function carryRelativeImports(sourcePath: string, targetPath: string, seen = new Set<string>()): Promise<string[]> {
  if (seen.has(sourcePath))
    return []
  seen.add(sourcePath)

  const source = await fs.promises.readFile(sourcePath, 'utf-8')
  const written: string[] = []

  // Both sides of the containment check below have to be real paths. cwd comes
  // back with symlinks already resolved (on macOS /var is /private/var), while
  // a path built from the target string does not, so comparing the two rejects
  // writes that are perfectly inside the project - anywhere the project itself
  // sits under a symlink.
  const root = realpathSync(process.cwd())
  const targetDir = realpathSync(dirname(targetPath))

  // `from './x'`, `from '../x'`, and the same inside `import type`.
  const specifiers = [...source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)].map(match => match[1])

  for (const specifier of new Set(specifiers)) {
    if (!specifier)
      continue

    const candidates = specifier.endsWith('.ts')
      ? [specifier]
      : [`${specifier}.ts`, `${specifier}/index.ts`]

    for (const candidate of candidates) {
      const from = resolve(dirname(sourcePath), candidate)
      const to = resolve(targetDir, candidate)

      if (!existsSync(from))
        continue

      // Never write outside the project. A specifier climbing past the app
      // root is a template bug, not something to act on.
      if (!to.startsWith(`${root}/`))
        break

      if (!existsSync(to)) {
        mkdirSync(dirname(to), { recursive: true })
        await fs.promises.copyFile(from, to)
        written.push(to)
      }

      written.push(...await carryRelativeImports(from, to, seen))
      break
    }
  }

  return written
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
    await log.error('No Stacks checkout found to vendor from.')
    log.info('Pass one with `--path <dir>`, or set STACKS_FRAMEWORK_PATH.')
    log.info('A checkout is required: the published packages ship `dist` only, so a copy of them would not be editable.')
    await log.flush()
    process.exit(ExitCode.FatalError)
  }

  const sourceCore = join(framework, 'storage/framework/core')
  const corePkgPath = resolve(sourceCore, 'package.json')
  if (!existsSync(corePkgPath)) {
    await log.error(`${sourceCore} has no package.json - that does not look like a Stacks checkout.`)
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
    await log.error('`bun install` failed. The files are in place; re-run the install once the failure is resolved.')
    process.exit(ExitCode.FatalError)
  }

  log.success('This project now runs on the vendored framework - edits under storage/framework/core are live.')
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

    log.info(`Layout:  vendored - ${italic(rel(coreDir))} (${packages.length} packages, v${corePkg.version ?? 'unknown'})`)
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

  log.info('Layout:  published packages - no storage/framework/core in this project')
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
    log.info(`Not vendored: ${italic(rel(targetDir))} - nothing to do.`)
    return
  }

  // Removing the override is only safe if something is left to resolve. An
  // app that vendored a package and never installed it would simply lose it.
  const installed = resolve(process.cwd(), 'node_modules', '@stacksjs', shortName)
  if (!existsSync(installed) && !force) {
    await log.error(`@stacksjs/${shortName} is not installed, so removing the vendored copy would leave nothing to resolve.`)
    log.info(`Run \`bun add @stacksjs/${shortName}\` first, or pass --force to remove it anyway.`)
    await log.flush()
    process.exit(ExitCode.FatalError)
  }

  await assertNoUncommittedChanges(targetDir, force)

  await fs.promises.rm(targetDir, { recursive: true, force: true })

  log.success(`Unpublished ${italic(rel(targetDir))} - @stacksjs/${shortName} now resolves from node_modules.`)
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
/**
 * Rewrite vendored bunfig preloads to package specifiers, and report which
 * packages they now name.
 *
 * `storage/framework/core/env/plugin.ts` and `@stacksjs/env/plugin.js` are the
 * same module, and the package's `./*` export maps the specifier onto its build
 * output. The names come back because a preloaded specifier has to be a DIRECT
 * dependency of the app - see the caller (stacksjs/stacks#2433 neighbours).
 */
/**
 * Packages a kept preload FILE falls back to.
 *
 * Not every preload becomes a package specifier. The main preloader stays a
 * relative path into the app, and inside it every framework import is written
 * as `import('../../../core/<name>/src/...').catch(() => import(pkg))` -
 * the vendored path first, the published package when that path is gone. In a
 * package-based app the vendored path IS gone, so the fallback is the only
 * branch that runs, and it needs the package to be resolvable.
 *
 * That is why `@stacksjs/env` alone was not enough: `preloader.ts` also falls
 * back to `@stacksjs/path`, and a scaffolded app died on
 * `Cannot find module '@stacksjs/path'` at the next step.
 *
 * The specifiers are deliberately split (`'@stacksjs/' + 'path'`) so bundlers
 * do not resolve them statically, so both spellings are matched here.
 */
export function packagesPreloadFilesFallBackTo(source: string): Set<string> {
  const found = new Set<string>()

  /*
   * ONLY the split form. `'@stacksjs/' + 'path'` is the idiom the file uses
   * for imports it cannot do without - the ones written as
   * `.catch(() => import(pkg))`, where failing means the process dies.
   *
   * Plain `'@stacksjs/x'` strings appear too, in the list the preloader walks
   * to populate globalThis, but that loop is already wrapped in try/catch and
   * degrades to "no auto-imports" rather than a crash. Matching those as well
   * collects 24 packages instead of 2 and would put the entire framework in
   * the app's direct dependencies to fix a two-package problem.
   */
  for (const match of source.matchAll(/'@stacksjs\/'\s*\+\s*'([a-z0-9-]+)'/g))
    found.add(`@stacksjs/${match[1]!}`)

  return found
}

export function rewriteBunfigPreloads(bunfig: string): { next: string, packages: Set<string>, rewritten: number } {
  const packages = new Set<string>()
  let rewritten = 0

  const next = bunfig.replace(
    /(["'])\.?\/?storage\/framework\/core\/([\w-]+)\/([^"']+?)\.ts\1/g,
    (_match, quote: string, pkgName: string, subpath: string) => {
      rewritten++
      packages.add(`@stacksjs/${pkgName}`)
      return `${quote}@stacksjs/${pkgName}/${subpath}.js${quote}`
    },
  )

  return { next, packages, rewritten }
}

async function unvendorFramework(force: boolean): Promise<void> {
  const coreDir = path.frameworkPath('core')
  const rel = (p: string) => p.replace(`${process.cwd()}/`, '')

  if (!existsSync(coreDir)) {
    log.info('No storage/framework/core in this project - already on the installed packages.')
    return
  }

  const corePkgPath = resolve(coreDir, 'package.json')
  if (!existsSync(corePkgPath)) {
    await log.error(`${rel(coreDir)} has no package.json, so its version cannot be determined.`)
    log.info('Unvendor the packages individually with `buddy unpublish:core <pkg>` instead.')
    await log.flush()
    process.exit(ExitCode.FatalError)
  }

  const corePkg = JSON.parse(await fs.promises.readFile(corePkgPath, 'utf-8')) as {
    name?: string
    version?: string
    dependencies?: Record<string, string>
  }
  const version = corePkg.version
  if (!version) {
    await log.error(`${rel(corePkgPath)} has no version field.`)
    process.exit(ExitCode.FatalError)
  }

  await assertNoUncommittedChanges(coreDir, force)

  // The vendored copy is routinely ahead of npm: a release commit bumps every
  // package.json in the monorepo, and publishing happens afterwards (or not at
  // all, for a local working checkout). Pinning `^<vendored version>` then
  // produces a package.json that no registry can resolve, and `bun install`
  // fails the scaffold with `No version matching "^x.y.z" found`. Ask the
  // registry what actually exists before writing the range.
  const depName = corePkg.name ?? 'stacks'
  const range = `^${await resolvePublishedVersion(depName, version)}`

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

  // Standalone framework runtime/build packages are not root workspace
  // members, but they survive the core deletion and still carry workspace
  // ranges from the monorepo template. Repoint those too.
  const survivingManifests = await rewriteSurvivingFrameworkManifests(process.cwd(), provided, range)

  // 2. bunfig.toml preloads point at source files inside core. Rewrite them to
  //    package specifiers: `storage/framework/core/env/plugin.ts` is the same
  //    module as `@stacksjs/env/plugin.js`, which the package's `./*` export
  //    maps onto its build output.
  const bunfigPath = resolve(process.cwd(), 'bunfig.toml')
  let rewrittenPreloads = 0
  if (existsSync(bunfigPath)) {
    const bunfig = await fs.promises.readFile(bunfigPath, 'utf-8')
    const { next, packages: preloadedPackages, rewritten } = rewriteBunfigPreloads(bunfig)
    rewrittenPreloads += rewritten

    if (next !== bunfig)
      await fs.promises.writeFile(bunfigPath, next)

    /*
     * A preloaded specifier has to be a DIRECT dependency.
     *
     * Rewriting the path to `@stacksjs/env/plugin.js` is only half the job: the
     * app declares `stacks`, and `@stacksjs/env` arrives underneath it as a
     * transitive package that bun does not put in the app's `node_modules`. So
     * every scaffolded app died before it ran a single line, on
     *
     *     error: preload not found "@stacksjs/env/plugin.js"
     *
     * which is not a missing file - the package publishes `dist/plugin.js` and
     * its `./*` export maps onto it - but a package the app never asked for.
     * The framework itself is declared ten lines above this for exactly the
     * same reason ("or nothing pulls it in"); preloads need the same treatment.
     */
    /*
     * A preload that stays a relative path still pulls packages in. Read the
     * kept files and add whatever they fall back to, or the app dies one step
     * later than it used to - `preloader.ts` needs `@stacksjs/path` and says so
     * only inside itself.
     */
    for (const match of next.matchAll(/["'](\.\/[^"']+\.ts)["']/g)) {
      const preloadPath = resolve(process.cwd(), match[1]!)
      if (!existsSync(preloadPath))
        continue

      for (const pkgName of packagesPreloadFilesFallBackTo(await fs.promises.readFile(preloadPath, 'utf-8')))
        preloadedPackages.add(pkgName)
    }

    let declaredForPreload = 0
    for (const pkgName of preloadedPackages) {
      if (rootPkg.dependencies?.[pkgName] || rootPkg.devDependencies?.[pkgName])
        continue

      rootPkg.dependencies = { ...rootPkg.dependencies, [pkgName]: range }
      declaredForPreload++
    }

    // Written a second time on purpose: the names only become known here, and
    // the earlier write happens before this block has read bunfig.
    if (declaredForPreload > 0)
      await fs.promises.writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`)
  }

  // 3. tsconfig.json inherits from the vendored core config, which is about to
  //    stop existing — and a missing `extends` target is a hard tsc error, so
  //    `bun run typecheck` breaks days later with nothing pointing back here.
  //    `storage/framework/tsconfig.app.json` is the package-layout equivalent,
  //    synced out of @stacksjs/defaults by `buddy upgrade`.
  const tsconfigPath = resolve(process.cwd(), 'tsconfig.json')
  let rewroteTsconfig = false
  let rewroteTypecheck = false
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

  // 3b. `typecheck` runs the FRAMEWORK's project (`tsconfig.framework.json`),
  //     which checks `storage/framework/**` and deliberately excludes `app/`,
  //     `config/`, `resources/` and `routes/` — they are checked by the root
  //     project instead. In the framework repository that split is right. In an
  //     app it means the one command anybody runs checks everything EXCEPT the
  //     code they write, quietly, forever. Run both.
  const splitTypecheck = splitFrameworkTypecheckScript(rootPkg.scripts ?? {})
  if (splitTypecheck) {
    rootPkg.scripts = splitTypecheck
    rewroteTypecheck = true
    await fs.promises.writeFile(rootPkgPath, `${JSON.stringify(rootPkg, null, 2)}\n`)
  }

  // 3c. Shell commands that RUN a framework action or the CLI by path
  //     (`bun storage/framework/core/actions/src/migrate/database.ts`). Every
  //     one has an exact `./buddy` equivalent that works in both layouts.
  //
  //     This runs BEFORE the workflow prune on purpose. The prune deletes any
  //     CI step that names the vendored core, which is right for a step that
  //     builds the framework's own packages and catastrophic for an app step
  //     that just happened to call `migrate` the long way round — that one
  //     gets silently deleted, and the smoke suite two steps later starts
  //     testing an API nothing ever booted. Repairing first leaves the prune
  //     nothing to match on, so those steps survive with a working command.
  const rewrittenCommands = await rewriteCoreCommandPaths(process.cwd())

  // 3d. CI jobs that build, test or compile the vendored packages. They fail by
  //     construction once the directory is gone, and nobody connects a red
  //     pipeline to an unvendor that happened weeks earlier — so it just stays
  //     red, and stops meaning anything.
  const prunedWorkflows = await pruneVendoredCoreFromWorkflows(process.cwd())

  // 3e. Project code that imports the vendored source by PATH rather than by
  //     package name (`import { serve } from
  //     './storage/framework/core/buddy/src/commands/serve'`). A package
  //     specifier resolves in both layouts; a relative path into core resolves
  //     in exactly one, and the app stops booting the moment the directory
  //     goes. The two are the same module — `./src/<rest>.ts` is what the
  //     package's `./*` export maps onto `./dist/<rest>.js`.
  const rewrittenImports = await rewriteCoreSourceImports(process.cwd())

  // 4. The vendored source itself, and any dependency-tree symlink still
  //    pointing into it. Those links survive the directory they point at and
  //    then resolve to nothing, so an import of that package fails with a
  //    missing module rather than falling back to the published copy.
  await fs.promises.rm(coreDir, { recursive: true, force: true })

  // This lock records the old monorepo workspace graph by path. Pantry does
  // not infer that hundreds of deleted entries should disappear, so force the
  // next install to resolve the package-layout graph from scratch.
  const pantryLock = resolve(process.cwd(), 'pantry.lock')
  const removedPantryLock = existsSync(pantryLock)
  await fs.promises.rm(pantryLock, { force: true })

  // Both layouts, not just node_modules: a pantry-installed app keeps the same
  // workspace symlinks under ./pantry, and leaving those dangling is the exact
  // failure this step exists to prevent.
  let danglingRemoved = 0
  for (const depsDir of ['node_modules', 'pantry']) {
    const scopedDir = resolve(process.cwd(), depsDir, '@stacksjs')
    if (!existsSync(scopedDir))
      continue

    for (const entry of await readdir(scopedDir, { withFileTypes: true })) {
      if (!entry.isSymbolicLink())
        continue

      const link = resolve(scopedDir, entry.name)
      if (existsSync(link))
        continue

      await fs.promises.rm(link, { force: true })
      danglingRemoved++
    }

    // `stacks` itself is linked at the top level, not under the scope.
    const rootLink = resolve(process.cwd(), depsDir, depName)
    if (existsSync(dirname(rootLink)) && isDanglingLink(rootLink)) {
      await fs.promises.rm(rootLink, { force: true })
      danglingRemoved++
    }
  }

  log.success(`Removed ${italic(rel(coreDir))}`)
  log.info(`package.json now depends on ${depName}@${range}`)
  if (repointed > 0)
    log.info(`Repointed ${repointed} workspace: range${repointed === 1 ? '' : 's'} to ${range}`)
  if (survivingManifests.ranges > 0)
    log.info(`Repointed ${survivingManifests.ranges} workspace: range${survivingManifests.ranges === 1 ? '' : 's'} across ${survivingManifests.files.length} surviving framework manifest${survivingManifests.files.length === 1 ? '' : 's'}`)
  if (removedPantryLock)
    log.info('Removed the legacy Pantry workspace lock; the install will resolve a package-layout graph')
  if (danglingRemoved > 0)
    log.info(`Removed ${danglingRemoved} node_modules symlink${danglingRemoved === 1 ? '' : 's'} left pointing into it`)
  if (rewrittenScripts > 0)
    log.info(`Repointed ${rewrittenScripts} package.json script${rewrittenScripts === 1 ? '' : 's'} to ./buddy`)
  if (rewrittenPreloads > 0)
    log.info(`Rewrote ${rewrittenPreloads} bunfig.toml preload path${rewrittenPreloads === 1 ? '' : 's'} to package specifiers`)
  if (rewroteTsconfig)
    log.info('tsconfig.json now extends storage/framework/tsconfig.app.json')
  if (rewroteTypecheck)
    log.info('`typecheck` now checks this app as well as the framework files it still ships')
  for (const pruned of prunedWorkflows) {
    const parts = [
      pruned.removedJobs.length > 0 ? `${pruned.removedJobs.length} job${pruned.removedJobs.length === 1 ? '' : 's'} (${pruned.removedJobs.join(', ')})` : '',
      pruned.removedSteps > 0 ? `${pruned.removedSteps} step${pruned.removedSteps === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    log.info(`${pruned.file}: removed ${parts.join(' and ')} that ran against the vendored core`)
  }

  if (rewrittenCommands.length > 0) {
    log.info(`Repointed vendored-CLI commands to ./buddy in ${rewrittenCommands.length} file${rewrittenCommands.length === 1 ? '' : 's'}:`)
    for (const file of rewrittenCommands)
      log.info(`  ${file}`)
  }

  if (rewrittenImports.length > 0) {
    log.info(`Repointed vendored-source imports to package specifiers in ${rewrittenImports.length} file${rewrittenImports.length === 1 ? '' : 's'}:`)
    for (const file of rewrittenImports)
      log.info(`  ${file}`)
  }

  // Anything still naming the directory is a path this command could not turn
  // into a package specifier on its own — a shell command that runs a source
  // file (`bun storage/framework/core/actions/src/dev/api.ts`), a CI path
  // filter, a bundler entrypoint. Rewriting those blind would be guesswork, so
  // name them instead: a listed file is a five-minute fix now, while an
  // unlisted one is a container that boots for the last time at 3am.
  const stragglers = await findCoreReferences(process.cwd())
  if (stragglers.length > 0) {
    log.warn(`${stragglers.length} file${stragglers.length === 1 ? '' : 's'} still reference storage/framework/core, which no longer exists:`)
    for (const { file, line, text } of stragglers)
      log.warn(`  ${file}:${line}  ${text}`)
    log.info('Run those through `./buddy <command>` or a package specifier before deploying.')
  }

  const installer = detectInstaller(process.cwd())
  log.info(`Installing the published packages with \`${installer.join(' ')}\`...`)
  const install = Bun.spawn(installer, { cwd: process.cwd(), stdout: 'inherit', stderr: 'inherit' })
  const code = await install.exited
  if (code !== 0) {
    await log.error(`\`${installer.join(' ')}\` failed. package.json and bunfig.toml were updated; re-run the install once the failure is resolved.`)
    process.exit(ExitCode.FatalError)
  }

  log.success('This project now runs on the published Stacks packages.')
  log.info('Vendor an individual package again any time with `buddy publish:core <pkg>`.')
}

/**
 * The version to pin the unvendored framework to.
 *
 * Prefers the vendored version, because that is the source the project has
 * been running against. When it is not on the registry — the normal state of a
 * checkout between a release bump and a publish — fall back to the newest
 * version that IS published, so the install resolves instead of failing. A
 * registry that cannot be reached is not fatal either: the vendored version is
 * still the best guess, and `bun install` reports the real problem.
 */
async function resolvePublishedVersion(depName: string, vendored: string): Promise<string> {
  let published: { latest?: string, versions: Set<string> }

  try {
    published = await fetchPublishedVersions(depName)
  }
  catch (error) {
    log.warn(`Could not reach the npm registry to check ${depName} versions (${error instanceof Error ? error.message : String(error)}).`)
    log.info(`Pinning the vendored version, ${depName}@^${vendored}.`)
    return vendored
  }

  if (published.versions.has(vendored))
    return vendored

  if (!published.latest) {
    log.warn(`${depName}@${vendored} is not published and the registry reports no latest version.`)
    return vendored
  }

  log.warn(`${depName}@${vendored} is not published yet - the vendored copy is ahead of npm.`)
  log.info(`Pinning the newest published version instead, ${depName}@^${published.latest}.`)
  return published.latest
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
    await log.flush()
    process.exit(ExitCode.FatalError)
  }
  catch {
    // git unavailable — proceed, the caller opted into this.
  }
}
