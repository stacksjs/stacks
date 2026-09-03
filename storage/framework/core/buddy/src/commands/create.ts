import type { CLI, CreateOptions } from '@stacksjs/types'
import { chmodSync, cpSync, existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { runAction } from '@stacksjs/actions'
import { bold, cyan, dim, intro, log, onUnknownSubcommand, runCommand } from "@stacksjs/cli"
import { Action } from '@stacksjs/enums'
import { resolve } from '@stacksjs/path'
import { isFolder } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'
import { uninstallAllFeatures } from './features'
import { ensurePantryDependencies, ensurePantryInstalled } from './setup'
import { resultFailed } from '../result'
import { fetchPublishedVersions } from '../registry'

interface NewOptions extends CreateOptions {
  withCore?: boolean
}

export function create(buddy: CLI): void {
  const descriptions = {
    name: 'The name of the project',
    command: 'Create a new Stacks project',
    ui: 'Are you building a UI?',
    components: 'Are you building UI components?',
    webComponents: 'Automagically built optimized custom elements/web components?',
    views: 'How about views?',
    functions: 'Are you developing functions/composables?',
    api: 'Are you building an API?',
    database: 'Do you need a database?',
    notifications: 'Do you need notifications? e.g. email, SMS, push or chat notifications',
    cache: 'Do you need caching?',
    email: 'Do you need email?',
    project: 'Target a specific project',
    minimal: 'Skip optional feature bundles (cms, commerce, dashboard, marketing, monitoring, realtime, queue) - bare-bones API/SPA starter that can re-add them later via `./buddy <feature>:install`.',
    withCore: 'Keep the framework vendored in `storage/framework/core` as a Bun workspace, for working ON Stacks. Apps that only work WITH Stacks want the default, which resolves every @stacksjs/* package from npm.',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('new [name]', descriptions.command)
    .alias('create [name]')
    .option('-n, --name [name]', descriptions.name, { default: false })
    .option('-u, --ui', descriptions.ui, { default: true }) // if no, disregard remainder of questions wrt UI
    .option('-c, --components', descriptions.components, { default: true })
    .option('-w, --web-components', descriptions.webComponents, { default: true })
    .option('-p, --views', descriptions.views, { default: true }) // i.e. `buddy dev`
    .option('-f, --functions', descriptions.functions, { default: true }) // if no, API would be false
    .option('-a, --api', descriptions.api, { default: true }) // APIs need an HTTP server & assumes functions is true
    .option('-d, --database', descriptions.database, { default: true })
    .option('-ca, --cache', descriptions.cache, { default: false })
    .option('-e, --email', descriptions.email, { default: false })
    .option('-P, --project [project]', descriptions.project, { default: false })
    .option('-m, --minimal', descriptions.minimal, { default: false })
    .option('--with-core', descriptions.withCore, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    // .option('--auth', 'Scaffold an authentication?', { default: true })
    .action(async (name, options: NewOptions) => {
      log.debug('Running `buddy new <name>` ...', options)

      const startTime = await intro('buddy new')

      name = name ?? options.name
      const path = resolve(process.cwd(), name)

      isFolderCheck(path)
      await onlineCheck()

      const result = await download(name, path, options)

      if (resultFailed(result)) {
        await log.error(result.error)
        process.exit(ExitCode.FatalError)
      }

  // Restore the exec bit BEFORE the environment step: the template ships
  // `buddy` non-executable (the tarball the gitit clone unpacks drops the
  // mode), and pantry's post-database-setup hook shells out to `./buddy
  // migrate` — which fails with `Permission denied` (exit 126) if the chmod
  // has not happened yet.
  ensureExecutableScripts(path)
  applyAppVcsTemplate(path)
  applyAppConfigTemplate(path)
  removeFrameworkTests(path)
  await ensureEnv(path, options)

  // Strip BEFORE install, not after. `install()` runs pantry's
  // post-database-setup hook, which shells out to `./buddy migrate` and
  // `./buddy seed` — and the migration runner gates a feature's tables on
  // `config.<feature>.enabled`. Stripping afterwards flipped that config on a
  // database that had already materialised and seeded every feature, so
  // `--minimal` produced a project whose config said commerce was off while
  // `orders`, `carts` and thirty-odd other tables sat there fully populated.
  // Nothing downstream could tell the difference between that and a project
  // that had asked for commerce.
  if (options.minimal)
    await stripFeatures(path)

  await install(path, options)

  if (!options.withCore)
    await unvendorCore(path, options)

      if (startTime) {
        const time = performance.now() - startTime
        log.success(dim(`[${time.toFixed(2)}ms] Completed`))
      }

      log.info(bold('Welcome to the Stacks Framework! ⚛️'))
      log.info(`Get started: ${cyan(`cd ${name}`)} and then ${cyan('./buddy dev')}`)
      log.info(`Run ${cyan('./buddy doctor')} anytime to check your setup`)
      log.info('To learn more, visit https://stacksjs.com')

      await log.flush()
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "new")
}

/**
 * An empty directory, or one holding nothing but `.git`, is a valid target:
 * creating the repository on GitHub first and cloning it before scaffolding is
 * the common way to start a project, and refusing that forced people to
 * scaffold under a throwaway name and shuffle files (and `.git`) by hand.
 *
 * Anything else still hard-fails — overwriting a real project is never what
 * `buddy new` was asked to do.
 */
function isFolderCheck(path: string) {
  if (!isFolder(path))
    return

  const occupied = readdirSync(path).filter(entry => entry !== '.git')

  if (occupied.length === 0)
    return

  console.error(`Path ${path} already exists`)
  process.exit(ExitCode.FatalError)
}

async function onlineCheck() {
  if (await isOnline())
    return

  log.info('It appears you are disconnected from the internet.')
  log.info('Creating a new project requires a brief internet connection to download the template and install dependencies.')
  await log.flush()
  process.exit(ExitCode.FatalError)
}

async function isOnline(): Promise<boolean> {
  try {
    const response = await fetch('https://github.com', {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  }
  catch {
    return false
  }
}

/**
 * Uses `@stacksjs/gitit`'s library API directly rather than shelling out to
 * `bunx --bun @stacksjs/gitit`. `bunx` always resolves the published npm
 * package into an ephemeral install, bypassing whatever gitit version is
 * actually installed in this project, and adds a registry round-trip that
 * has no benefit here since gitit is already a direct dependency.
 *
 * The source is pinned to `gh:stacksjs/stacks` on purpose: gitit's default
 * template registry still points the bare `stacks` name at the old org and
 * only reaches us via GitHub's repo-transfer redirect. Resolving the GitHub
 * provider directly removes that third-party lookup (and its supply-chain
 * risk) entirely.
 *
 * `force` lets the template extract into an already-existing directory, which
 * is what makes scaffolding into a freshly cloned repository work: gitit
 * otherwise refuses any non-empty destination, and a `.git` directory counts as
 * non-empty. It unpacks alongside whatever is there rather than clearing it, so
 * `.git` survives. Never use `forceClean` here — that deletes the destination
 * first, which would take the repository's history with it. `isFolderCheck()`
 * has already established the target holds nothing but `.git`.
 */
/**
 * The template ref to scaffold from: the tag matching the framework version the
 * app is about to pin, or `null` for the default branch.
 *
 * This used to be the default branch unconditionally, while `unpublish:core`
 * pinned the framework to the newest PUBLISHED version. Those are two different
 * points in history, and the gap between them is exactly where a release has
 * not happened yet - so a freshly scaffolded app carried userland (`config/`,
 * `app/`, `routes/`) written against framework changes it could not install,
 * and failed its own `./buddy typecheck` before the user had touched anything.
 * `MobileConfig` did it in stacksjs/stacks#2322, and `security.api` was doing
 * it again while this was being written.
 *
 * Scaffolding from the tag removes the disagreement by construction rather than
 * reporting it afterwards, and makes `buddy new` reproducible: two people
 * scaffolding a week apart get the same app rather than whatever main happened
 * to be.
 */
export async function templateRef(
  fetchVersions: typeof fetchPublishedVersions = fetchPublishedVersions,
): Promise<string | null> {
  try {
    const { latest } = await fetchVersions('stacks')
    // A package with no release has no tag to scaffold from either.
    return latest ? `v${latest}` : null
  }
  catch {
    // An unreachable registry is not a reason to refuse to scaffold. The
    // default branch is what shipped before this, so fall back to it.
    return null
  }
}

/** The gitit spec for a template ref, or the default branch when there is none. */
export function templateSpec(ref: string | null): string {
  return ref ? `gh:stacksjs/stacks#${ref}` : 'gh:stacksjs/stacks'
}

async function download(name: string, path: string, _options: CreateOptions) {
  log.info('Setting up your stack.')

  const ref = await templateRef()

  try {
    const { downloadTemplate } = await import('@stacksjs/gitit')
    try {
      await downloadTemplate(templateSpec(ref), { dir: name, force: true })
    }
    catch (error) {
      // The registry named a version whose tag is not on GitHub - a publish
      // that landed without its tag, or a tag naming scheme that has moved on.
      // Scaffolding from the default branch is the old behaviour and still
      // produces a working app far more often than not, so say what happened
      // and carry on rather than failing here.
      if (!ref) throw error
      log.warn(`No ${ref} tag to scaffold from (${error instanceof Error ? error.message : String(error)}).`)
      log.info('Falling back to the default branch. If this app does not typecheck, that gap is why.')
      await downloadTemplate(templateSpec(null), { dir: name, force: true })
    }
    log.success(`Successfully scaffolded your project at ${cyan(path)}`)
    return { isErr: false as const }
  }
  catch (error) {
    return { isErr: true as const, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * The template is the framework's own repository, so it arrives carrying the
 * framework's own `.github/` — workflows written for THIS monorepo. They run
 * `./storage/framework/scripts/publish-commit` and measure the export size of
 * `./storage/framework/core/*`, neither of which a generated app has; once the
 * app unvendors (the default, immediately below) it never will. The app-shaped
 * set has existed the whole time at `defaults/vcs/github` and was simply never
 * the one that shipped (stacksjs/stacks#2239).
 *
 * Runs BEFORE unvendorCore, which deletes `storage/framework` and takes the
 * source directory with it.
 *
 * A missing source is a warning, not a fatal: scaffolding has otherwise
 * succeeded at this point, and an app with the framework's CI is a worse
 * outcome than one with no CI, but neither is worth discarding the download
 * over. `scaffold-vcs-template.test.ts` is what stops the directory going
 * missing in the first place.
 */
function applyAppVcsTemplate(path: string) {
  const source = resolve(path, 'storage/framework/defaults/vcs/github')
  const destination = resolve(path, '.github')

  if (!existsSync(source)) {
    log.warn('No app CI template found at storage/framework/defaults/vcs/github - leaving .github as downloaded.')
    return
  }

  log.info('Installing app-shaped GitHub workflows...')

  try {
    // Replaced wholesale rather than merged: a merge would leave the
    // framework-only workflows (publish-commit, desktop-app-store,
    // browser-extension-release) in place, and those are precisely what must
    // not ship. Every file the app should have is in the template.
    rmSync(destination, { recursive: true, force: true })
    cpSync(source, destination, { recursive: true })
    log.success('App CI installed')
  }
  catch (error) {
    log.warn(`Could not install the app CI template: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Replace the framework repository's owner-specific infrastructure settings
 * with safe application defaults.
 *
 * `buddy new` downloads this repository as its template, so without this pass
 * a new app inherits the Stacks production project slug, attached tenants,
 * hosted-zone id, mailboxes, forwards, and team roster. A later `buddy deploy`
 * can then target infrastructure owned by the framework repository. The app
 * template keeps the useful cloud primitives while making every external
 * integration opt-in and disabling mail-server reconciliation by default.
 *
 * Runs before unvendoring because its source lives under the defaults tree.
 */
function applyAppConfigTemplate(path: string) {
  const source = resolve(path, 'storage/framework/defaults/scaffold/config')
  const destination = resolve(path, 'config')

  if (!existsSync(source)) {
    log.warn('No app config template found at storage/framework/defaults/scaffold/config - leaving config as downloaded.')
    return
  }

  const slug = path.replace(/\/+$/, '').split('/').pop() || 'stacks-app'
  const displayName = slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')

  log.info('Installing app-safe infrastructure configuration...')

  try {
    for (const file of readdirSync(source)) {
      if (!file.endsWith('.ts'))
        continue

      const template = readFileSync(resolve(source, file), 'utf8')
      const rendered = template
        .replaceAll('__APP_NAME__', displayName)
        .replaceAll('__APP_SLUG__', slug)

      writeFileSync(resolve(destination, file), rendered)
    }
    log.success('App-safe infrastructure configuration installed')
  }
  catch (error) {
    log.warn(`Could not install the app config template: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Drop the framework's own test suite.
 *
 * Same root as `applyAppVcsTemplate` above: the template IS this repository,
 * so the download carries `tests/` — 41 files asserting on `storage/framework/
 * defaults/...` and on the layout of `core/`. `unvendorCore` deletes both a
 * few steps later, so every one of them fails on ENOENT, in an app that never
 * asked for them and cannot fix them.
 *
 * erbamarkets shipped that way and ran 117 red tests from its first commit.
 * The cost is not the failures themselves — it is that a suite which is always
 * red is read exactly as often as no suite, so the app's own first real test
 * would have landed in a list nobody looks at.
 *
 * `tests/setup.ts` stays. It is harness rather than assertion: it seeds the
 * env vars config reads at module scope and shims `requestAnimationFrame`,
 * and `bunfig.toml` preloads it by name for the app's own tests.
 */
function removeFrameworkTests(path: string) {
  const tests = resolve(path, 'tests')

  if (!existsSync(tests))
    return

  log.info('Removing the framework\'s own test suite...')

  for (const entry of readdirSync(tests)) {
    if (entry === 'setup.ts')
      continue

    rmSync(resolve(tests, entry), { recursive: true, force: true })
  }

  log.success('App starts with a clean test suite')
}

function ensureExecutableScripts(path: string) {
  for (const script of ['buddy', 'bootstrap']) {
    try {
      chmodSync(resolve(path, script), 0o755)
    }
    catch {
      // If the template changes and a script is not present, install() will
      // surface the missing executable in the command that needs it.
    }
  }
}

async function ensureEnv(path: string, _options: CreateOptions) {
  log.info('Ensuring your environment is ready...')
  // Bootstrap the Pantry CLI (idempotent) and install the new project's
  // complete machine and project dependency graph declared by the template.
  await ensurePantryInstalled()
  await ensurePantryDependencies(path)
  log.success('Environment is ready')
}

async function install(path: string, options: CreateOptions) {
  log.info('Installing & setting up Stacks')

  log.info('Copying .env.example → .env')
  let result = await runCommand('cp .env.example .env', { ...options, cwd: path })

  if (resultFailed(result)) {
    await log.error(result.error)
    process.exit(ExitCode.FatalError)
  }

  // The template ships .env.development/.staging/.production encrypted with
  // the UPSTREAM repo's dotenvx keys (and no .env.keys), so a fresh app can
  // never decrypt them — they only leak "encrypted:..." garbage into config
  // (e.g. `email.default: expected one of [...], got "encrypted:..."`).
  // Drop them; `buddy env:encrypt` regenerates per-project files when needed.
  log.info('Removing template-encrypted env files...')
  const { rm } = await import('node:fs/promises')
  for (const stale of ['.env.development', '.env.staging', '.env.production', '.env.keys'])
    await rm(`${path}/${stale}`, { force: true })

  log.info('Generating application key...')
  const keyResult = await runAction(Action.KeyGenerate, { ...options, cwd: path })
  if (resultFailed(keyResult)) {
    await log.error(keyResult.error)
    process.exit(ExitCode.FatalError)
  }

  // Scaffolding into a cloned repository is supported (see isFolderCheck), and
  // re-running `git init` there would be pointless noise at best.
  if (existsSync(resolve(path, '.git'))) {
    log.info('Existing git repository detected, skipping git init')
  }
  else {
    log.info('Initializing git repository...')
    result = await runCommand('git init', { ...options, cwd: path })
    if (resultFailed(result)) {
      await log.error(result.error)
      process.exit(ExitCode.FatalError)
    }
  }

  log.success('Installed & set-up 🚀')
}

/**
 * The template ships the whole framework source under `storage/framework/core`
 * wired up as a Bun workspace. That layout is for working ON Stacks; an app that
 * only works WITH Stacks wants the same packages from npm, which is what the
 * single `stacks` dependency in package.json pulls in. So the default is to
 * unvendor right after install, and `--with-core` opts back into the workspace.
 *
 * Delegating to the new project's own `./buddy` keeps the whole rewrite (root
 * manifest, workspace globs, bunfig preloads, symlink pruning, reinstall) in the
 * one implementation that owns it, and runs it with the new project as cwd,
 * which is what it resolves paths against.
 *
 * `--force` is required and safe here: the check it bypasses exists to protect
 * local edits to vendored packages, and this tree is a pristine template
 * download seconds old. Unvendoring before the first commit also keeps ~2,000
 * vendored framework files out of the repository's history for good.
 */
async function unvendorCore(path: string, options: NewOptions) {
  log.info('Resolving the framework from npm (pass --with-core to keep it vendored)...')

  const result = await runCommand('./buddy unpublish:core --all --force', { ...options, cwd: path })

  if (resultFailed(result)) {
    const reason = result.error instanceof Error
      ? (result.error.stack ?? result.error.message)
      : String(result.error ?? '').trim()

    log.error('Could not resolve the framework from npm.')
    log.error(reason.length > 0 ? reason : 'The step failed without reporting a reason.')
    log.error('')
    log.error(`The project at ${path} is half converted: the vendored framework has been`)
    log.error('removed and the published packages are not in place yet, so ./buddy cannot')
    log.error('boot there. Finish it by hand with:')
    log.error('')
    await log.error(`  cd ${path} && rm -f node_modules/stacks && bun install`)
    await log.error('')
    await log.error('Or start over with `--with-core` to keep the framework vendored.')
    process.exit(ExitCode.FatalError)
  }

  log.success('Framework resolved from npm')
}

/**
 * Implements `./buddy new --minimal` (stacksjs/stacks#1854): the
 * `@stacksjs/gitit` template clones the kitchen-sink layout (every
 * feature's actions, models, views, config), so the minimal pass
 * disables each feature flag and removes its stamped scaffolding right
 * after install. Users can re-add features later via
 * `./buddy <feature>:install`.
 */
async function stripFeatures(path: string) {
  log.info('Stripping optional feature bundles (--minimal)...')
  const results = await uninstallAllFeatures({ root: path })

  let strippedAny = false
  for (const { feature, configOutcome, filesRemoved } of results) {
    if (configOutcome === 'flipped' || filesRemoved.length > 0) {
      strippedAny = true
      const fileSummary = filesRemoved.length > 0 ? ` (${filesRemoved.length} path${filesRemoved.length === 1 ? '' : 's'})` : ''
      log.info(`  - ${feature}${fileSummary}`)
    }
  }

  if (!strippedAny)
    log.info('  → no feature scaffolding present; nothing to strip.')
  else
    log.success('Minimal skeleton ready - run `./buddy <feature>:install` to add features back.')
}
