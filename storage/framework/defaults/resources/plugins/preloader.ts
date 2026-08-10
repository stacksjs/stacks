/**
 * Main Preloader
 *
 * This file is loaded before the main (Bun) process is started.
 * You may use this file to preload/define plugins that will
 * automatically be injected into the Bun process.
 */

// Skip preloader for fast CLI commands (e.g. `buddy dev`, `buddy --version`) to
// maximize startup speed. We must NOT skip when running a server script directly
// (e.g. `bun --watch storage/framework/core/actions/src/dev/api.ts`) — Bun
// consumes `--watch` so `args` ends up empty in that subprocess, which used to
// trip the `args.length === 0` short-circuit and silently disable auto-imports.
const args = process.argv.slice(2)
const fastCommands = [
  'dev',
  'build',
  'test',
  'lint',
  '--version',
  '-v',
  'version',
  '--help',
  '-h',
  'help',
  // Database / codegen — must not pull the full auto-import graph (router,
  // orm models, …) before bun-query-builder can diff schemas. A broken
  // `@stacksjs/bun-router` install used to make `generate:migrations` exit 1
  // with no output because the preloader died while loading `@stacksjs/router`.
  'migrate',
  'fresh',
  'seed',
  'generate',
  'make',
  'key:generate',
  'scaffold:crud',
]
const isRepl = !process.argv[1]
// Dependency installation runs package lifecycle scripts before Bun has finished
// linking every workspace package. Loading @stacksjs/env (or the wider auto-import
// graph) from a postinstall script can therefore fail even though the install is
// otherwise valid. Postinstall scripts are bootstrap work and must stay independent
// of the application runtime preloader.
const isPostinstall = process.env.npm_lifecycle_event === 'postinstall'
const skipPreloader = isRepl || isPostinstall || (args.length > 0 && fastCommands.some(cmd => args[0] === cmd || args[0].startsWith(`${cmd}:`)))

if (!skipPreloader) {
  // Detect production/deployment commands and set environment accordingly BEFORE loading env files
  // This ensures the correct .env.{env} file is loaded with proper encryption/decryption
  const productionCommands = ['cloud:remove', 'cloud:rm', 'cloud:destroy', 'cloud:cleanup', 'cloud:clean-up', 'undeploy']
  const isProductionCommand = productionCommands.includes(args[0])

  // Handle deploy command: the env may be positional (`deploy staging`) or a
  // flag (`deploy --staging`). CI deploys use the flag form, so detecting only
  // the positional arg left APP_ENV wrong and loaded the wrong .env file.
  const isDeployCommand = args[0] === 'deploy'
  if (isDeployCommand) {
    const flagEnv = args.includes('--production') || args.includes('--prod')
      ? 'production'
      : args.includes('--staging')
        ? 'staging'
        : args.includes('--development') || args.includes('--dev')
          ? 'development'
          : undefined
    const positionalEnv = args[1] && !args[1].startsWith('-') ? args[1] : undefined
    const deployEnv = flagEnv ?? positionalEnv ?? 'production'
    process.env.APP_ENV = deployEnv
    process.env.NODE_ENV = deployEnv
  }
  else if (isProductionCommand) {
    process.env.APP_ENV = 'production'
    process.env.NODE_ENV = 'production'
  }
}

// Decrypt and load .env files for real command invocations. This is gated on
// isRepl / isPostinstall ONLY, not on the fast-command `skipPreloader`: fast
// commands (migrate, build, seed, ...) DO need decrypted config, which the old
// `skipPreloader` gate wrongly denied them (an encrypted `.env.<env>` never
// decrypted for those commands even with the key present). See stacksjs/stacks#2048.
//
// Postinstall still skips: @stacksjs/env may not be linked yet mid-install, so
// importing it there can fail (see the isPostinstall note above). The REPL keeps
// its original skip. The heavy auto-import graph below stays gated separately via
// `skipAutoImports`.
if (!isRepl && !isPostinstall) {
  // Resolve the vendored source first; the package fallback covers non-standard
  // layouts where defaults is consumed outside the framework layout.
  const envPackage = '@stacksjs/' + 'env'
  const { autoLoadEnv } = await import('../../../core/env/src/plugin.ts')
    .catch(() => import(envPackage))

  // Pass the resolved env so deploy commands deterministically select their
  // matching `.env.<env>` file. autoLoadEnv discovers `.env.keys` by default,
  // replaces ciphertext that Bun preloaded, and preserves genuine shell/CI
  // overrides while applying environment-specific file precedence. quiet: true
  // prevents duplicate logging across multiple processes.
  autoLoadEnv({ quiet: true, env: process.env.APP_ENV })

  // Tell stx and ts-cloud where their state lives before anything imports them.
  // Both keep it under `storage/` in a Stacks app rather than in a dot-directory
  // at the project root, both take the location from their own config, and both
  // read an environment variable ahead of that config — which is also what
  // carries the answer into every process a command spawns. Setting it here
  // means no boot order can leave a library writing to `.stx` / `.ts-cloud`.
  //
  // Guarded because this preload runs before ANY command: an app resolving
  // `@stacksjs/path` from npm can legitimately be on a published version that
  // predates this helper, and a bare call there throws
  // `applyRuntimeDirectoryEnv is not a function` out of a bunfig preload,
  // which takes down every `buddy` invocation including the `install` and
  // `upgrade` that would fix it. Falling through leaves stx and ts-cloud on
  // their own defaults, which is degraded but recoverable.
  const pathPkg = '@stacksjs/' + 'path'
  const { applyRuntimeDirectoryEnv } = await import('../../../core/path/src/index.ts')
    .catch(() => import(pathPkg))

  if (typeof applyRuntimeDirectoryEnv === 'function')
    applyRuntimeDirectoryEnv()
  else
    console.warn('[stacks] installed @stacksjs/path has no applyRuntimeDirectoryEnv; stx and ts-cloud will use their default state directories. Run `buddy upgrade` to refresh the framework packages.')
}

// stx template engine plugin
// enables .stx file processing
// NOTE: Commented out until bun-plugin-stx is properly installed
// Uncomment after running: bun add bun-plugin-stx
// eslint-disable-next-line antfu/no-top-level-await
// await import('bun-plugin-stx')

/**
 * Whether a bare `@stacksjs/*` specifier resolves to something belonging to
 * THIS project, and is therefore safe to import.
 *
 * A bare specifier resolves through node_modules, and when that is missing or
 * half-installed bun falls back to its GLOBAL install cache. So a project with
 * a broken install did not fail. It silently booted against whatever published
 * version happened to be sitting in ~/.bun/install/cache, which is worse than
 * loading nothing and completely invisible.
 *
 * It also hung, and that is how it was found. On Linux the first such
 * cache-resolved import never settles: no rejection, no active handles, the
 * process simply stops, so every stage of the preloader after it is silently
 * unreachable. Both callers wrap their import in a `catch` that assumes a bad
 * specifier fails FAST. That holds for one that cannot be resolved at all. It
 * does not hold for one that resolves to a stale copy.
 *
 * ## Why this is a directory probe and not `Bun.resolveSync`
 *
 * The first version of this guard asked `Bun.resolveSync`, which answers the
 * question exactly but pays full module resolution to do it. Measured on a
 * Linux CI runner, a specifier that is NOT in `node_modules` cost **0.9 to 2.0
 * seconds per call**, because bun walks the entire tree and then scans a global
 * cache the install had just filled with 600+ packages. Twenty of those is 20
 * to 40 seconds, so the guard turned a hang into a crawl and the preloader test
 * kept timing out, intermittently, depending on how loaded the runner was.
 *
 * Locating the `node_modules/@stacksjs` directory once and then asking
 * `existsSync` per package is the same question answered with stat calls:
 * microseconds, and it never touches the global cache. The walk is memoised
 * because the answer cannot change within a process.
 *
 * Accepted: a package present in this project's `@stacksjs` scope directory,
 * which covers a real install and a vendored checkout alike (the framework's
 * own core packages are symlinked into it). Anchored on `import.meta.dir`
 * rather than the cwd, so running a command from a subdirectory does not change
 * what loads.
 */
let stacksScopeDir: string | null | undefined

async function findStacksScopeDir(): Promise<string | null> {
  if (stacksScopeDir !== undefined)
    return stacksScopeDir

  const { existsSync } = await import('node:fs')
  const { dirname, join } = await import('node:path')

  let dir = import.meta.dir
  for (;;) {
    const candidate = join(dir, 'node_modules', '@stacksjs')
    if (existsSync(candidate)) {
      stacksScopeDir = candidate
      return candidate
    }
    const parent = dirname(dir)
    if (parent === dir)
      break
    dir = parent
  }

  stacksScopeDir = null
  return null
}

async function belongsToThisProject(specifier: string): Promise<boolean> {
  const scopeDir = await findStacksScopeDir()
  if (!scopeDir)
    return false

  const { existsSync } = await import('node:fs')
  const { join } = await import('node:path')

  return existsSync(join(scopeDir, specifier.slice('@stacksjs/'.length)))
}

// Auto-import ALL Stacks framework modules into globalThis
// This allows using Action, response, Activity, etc. without ANY imports.
// Exported so server entrypoints (e.g. `dev/api.ts`) can opt back in
// explicitly when needed — see #1835 root cause 3.
export async function loadAutoImports() {
  const { Glob } = await import('bun')
  const pathPackage = '@stacksjs/' + 'path'
  const path = await import('../../../core/path/src/index.ts')
    .catch(() => import(pathPackage))

  // CRITICAL: Never overwrite these built-in globals
  const protectedGlobals = new Set([
    'process', 'globalThis', 'global', 'window', 'self',
    'console', 'require', 'module', 'exports', '__dirname', '__filename',
    'Buffer', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'setImmediate', 'clearImmediate', 'queueMicrotask',
    'fetch', 'Request', 'Response', 'Headers', 'URL', 'URLSearchParams',
    'TextEncoder', 'TextDecoder', 'Blob', 'File', 'FormData',
    'crypto', 'performance', 'navigator', 'location',
    'Promise', 'Symbol', 'Proxy', 'Reflect', 'WeakMap', 'WeakSet', 'Map', 'Set',
    'Array', 'Object', 'String', 'Number', 'Boolean', 'Date', 'RegExp', 'Error',
    'JSON', 'Math', 'Intl', 'eval', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
    'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent',
    'Bun', 'Deno', 'Node',
  ])

  // 1. Load Stacks framework packages into globalThis
  const stacksPackages = [
    '@stacksjs/actions',
    '@stacksjs/router',
    '@stacksjs/orm',
    '@stacksjs/validation',
    '@stacksjs/strings',
    '@stacksjs/arrays',
    '@stacksjs/objects',
    '@stacksjs/collections',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/env',
    '@stacksjs/config',
    '@stacksjs/logging',
    '@stacksjs/cache',
    '@stacksjs/queue',
    '@stacksjs/events',
    '@stacksjs/notifications',
    '@stacksjs/email',
    '@stacksjs/security',
    '@stacksjs/auth',
    '@stacksjs/database',
    '@stacksjs/error-handling',
    // Signal helpers (`state`, `derived`, `effect`) and browser-side
    // composables (`useDark`, `usePreferredDark`, `useStorage`) need to
    // land in globalThis before step 2 imports any file under
    // resources/functions/ — counter.ts and dark.ts call those at
    // module top level, so missing globals throw and leave the module
    // in TDZ, surfacing later as `Cannot access 'count' before
    // initialization` when the auto-imports barrel re-imports them.
    '@stacksjs/stx',
    '@stacksjs/browser',
  ]

  for (const pkg of stacksPackages) {
    // See `belongsToThisProject`. Skipping is what the `catch` below always
    // meant to do; it just never got the chance for a specifier that resolves
    // to a stale copy instead of failing.
    if (!(await belongsToThisProject(pkg)))
      continue

    try {
      const module = await import(pkg)
      for (const [name, value] of Object.entries(module)) {
        // Skip default exports and protected globals
        if (name === 'default' || protectedGlobals.has(name)) continue
        if (typeof value !== 'undefined') {
          (globalThis as any)[name] = value
        }
      }
    } catch {
      // Package might not exist or not be built yet
    }
  }

  // 2. Load all functions from resources/functions
  const functionsPath = path.resourcesPath('functions')
  const glob = new Glob('**/*.ts')

  for await (const file of glob.scan({
    cwd: functionsPath,
    absolute: true,
    onlyFiles: true,
  })) {
    if (file.endsWith('.d.ts')) continue

    try {
      const module = await import(file)
      for (const [name, value] of Object.entries(module)) {
        // Skip default exports and protected globals
        if (name === 'default' || protectedGlobals.has(name)) continue
        if (typeof value !== 'undefined') {
          (globalThis as any)[name] = value
        }
      }
    } catch {
      // Some files may have client-side dependencies, skip them
    }
  }

  // 3. Load all defineModel()-based model instances into globalThis
  // This enables using Post.where('title', 'test') without imports
  // Priority: user models (app/Models) override framework defaults
  const modelDirs = [
    path.userModelsPath(),
    path.storagePath('framework/defaults/app/Models'),
  ]

  const loadedModels = new Set<string>()

  for (const dir of modelDirs) {
    try {
      for await (const file of glob.scan({
        cwd: dir,
        absolute: true,
        onlyFiles: true,
      })) {
        if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

        const modelName = file.split('/').pop()?.replace('.ts', '') || ''
        if (!modelName || loadedModels.has(modelName) || protectedGlobals.has(modelName)) continue

        try {
          const module = await import(file)
          if (module.default) {
            (globalThis as any)[modelName] = module.default
            loadedModels.add(modelName)
          }
        } catch {
          // Model may have unresolved dependencies during bootstrap
        }
      }
    } catch {
      // Directory may not exist
    }
  }

  // 4. Load all Job instances from app/Jobs into globalThis
  // This enables using SendWelcomeEmail.dispatch() without imports
  const jobsDir = path.userJobsPath()
  const loadedJobs = new Set<string>()

  try {
    for await (const file of glob.scan({
      cwd: jobsDir,
      absolute: true,
      onlyFiles: true,
    })) {
      if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

      const jobName = file.split('/').pop()?.replace('.ts', '') || ''
      if (!jobName || loadedJobs.has(jobName) || protectedGlobals.has(jobName)) continue

      try {
        const module = await import(file)
        if (module.default) {
          (globalThis as any)[jobName] = module.default
          loadedJobs.add(jobName)
        }
      } catch {
        // Job may have unresolved dependencies during bootstrap
      }
    }
  } catch {
    // Directory may not exist
  }

  // 5. Load all Controller classes into globalThis
  // This enables using ComingSoonController without imports
  // Priority: user controllers > default controllers
  const controllerDirs = [
    path.userControllersPath(),
    path.storagePath('framework/defaults/app/Controllers'),
  ]
  const loadedControllers = new Set<string>()

  for (const dir of controllerDirs) {
    try {
      for await (const file of glob.scan({
        cwd: dir,
        absolute: true,
        onlyFiles: true,
      })) {
        if (file.endsWith('.d.ts') || file.endsWith('/index.ts')) continue

        const controllerName = file.split('/').pop()?.replace('.ts', '') || ''
        if (!controllerName || loadedControllers.has(controllerName) || protectedGlobals.has(controllerName)) continue

        try {
          const module = await import(file)
          if (module.default) {
            (globalThis as any)[controllerName] = module.default
            loadedControllers.add(controllerName)
          }
        } catch {
          // Controller may have unresolved dependencies during bootstrap
        }
      }
    } catch {
      // Directory may not exist
    }
  }
}

// Load auto-imports for server/API contexts (serve, any server process)
// Skip for fast commands (dev, build, test, etc.) and CLI info commands.
// `args[0]` may be undefined when running a script directly (e.g. dev subprocess);
// guard so .includes() doesn't accidentally treat that as a CLI info command.
// `./buddy dev` server subprocesses set STACKS_DEV_SERVER=1. They load only
// what they need themselves — the API injects globals via injectGlobalAutoImports
// and reads the cached package-discovery manifest, while the frontend/docs
// servers never touch models — so the preloader's eager ~800ms auto-import +
// discoverPackages pass is redundant work on the critical boot path. Skip it.
const skipAutoImports = skipPreloader || process.env.STACKS_DEV_SERVER === '1' || (args.length > 0 && ['--version', '-v', 'version', '--help', '-h', 'help'].includes(args[0]))
if (!skipAutoImports) {
  await loadAutoImports()

  // Run package auto-discovery after all imports are loaded
  const actionsPackage = '@stacksjs/' + 'actions'
  if (await belongsToThisProject(actionsPackage)) {
    try {
      const { discoverPackages } = await import(actionsPackage)
      await discoverPackages()
    }
    catch {
      // Discovery may fail during early bootstrap — not critical
    }
  }
}
