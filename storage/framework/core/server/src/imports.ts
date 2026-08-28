import type { AutoImportsOptions } from 'bun-plugin-auto-imports'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, relative, resolve as resolvePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import { plugin } from 'bun'
import { log } from '@stacksjs/logging'
import { path } from '@stacksjs/path'
import { autoImports, generateRuntimeIndex, generateGlobalsScript } from 'bun-plugin-auto-imports'
import { globSync } from '@stacksjs/storage'
import { primitiveAutoImportEntries, primitiveModules } from './primitive-imports'

interface ExportInfo {
  name: string
  file: string
  isDefault?: boolean
}

/**
 * Feature-module subdirectories under storage/framework/defaults/app/Models
 * that are only included when the project opts into the module via config.
 * Key = subdir name, value = list of config files (any one present = enabled).
 *
 * Add new feature modules here when the framework introduces them. Always-on
 * top-level infra models (User, Notification, Job, FailedJob, Log, Error, …)
 * are NOT listed; they're scanned unconditionally.
 */
const OPTIONAL_MODEL_MODULES: Record<string, string[]> = {
  commerce: ['config/commerce.ts'],
  Content: ['config/cms.ts', 'config/blog.ts'],
  Forms: ['config/forms.ts'],
  realtime: ['config/realtime.ts'],
}

function configEnabled(configRelPaths: string[]): boolean {
  return configRelPaths.some(rel => existsSync(path.projectPath(rel)))
}

/**
 * A framework-defaults subdirectory, wherever it actually lives.
 *
 * These used to be `path.storagePath('framework/defaults/<sub>')` and nothing
 * else, which is correct for a vendored app and fatal for one consuming the
 * framework as packages. An app that has dropped `storage/framework/` still has
 * the identical files in `@stacksjs/defaults`, but boot never looked there: the
 * scan was handed a path that did not exist, and `scanDirExportsDetailed` in
 * bun-plugin-auto-imports THROWS on a missing directory rather than returning
 * nothing. The API then dies at startup with
 *
 *   Failed to scan directory .../storage/framework/defaults/functions
 *
 * which is not caught by the tolerance already added around these scans,
 * because the throw happens inside the plugin.
 *
 * Vendored first, so an app with the tree behaves exactly as before and this
 * cannot change what an existing project resolves. Package second. `undefined`
 * when neither exists, which callers drop from the scan list — a framework
 * default that is genuinely absent is not an error, it just contributes no
 * auto-imports.
 *
 * Resolving via `package.json` is deliberate: `@stacksjs/defaults` publishes no
 * `.` export, so the bare specifier does not resolve, and these are data
 * directories rather than modules. Inside this monorepo the specifier lands on
 * the workspace package, which holds only build files — no `functions/`, no
 * `app/` — so the lookup misses and the vendored branch wins, which is what we
 * want when developing the framework itself.
 *
 * The one exception to vendored-first is a tree the installed package has
 * already moved past. `buddy upgrade` is the only thing that writes
 * `storage/framework/defaults`, so bumping `stacks` in package.json and running
 * `bun install` leaves a copy of an older release sitting in front of the one
 * the app actually declared. That copy is a cache, not source, and preferring
 * it means booting code from a release nobody asked for. Only a recorded
 * version that disagrees with the installed one flips the order: an unstamped
 * tree, a framework checkout, and a linked checkout all keep resolving exactly
 * as before. See `inspectDefaultsProvenance`.
 */
export function frameworkDefaultsDir(sub: string): string | undefined {
  const vendored = path.storagePath(`framework/defaults/${sub}`)

  return resolveDefaultsDir(
    existsSync(vendored) ? vendored : undefined,
    packagedDefaultsDir(sub),
    vendoredDefaultsAreStale(),
  )
}

/**
 * The precedence rule on its own, so it can be pinned without a project on
 * disk. Vendored wins unless it is a copy of a release the app has already
 * moved past, and a missing side never beats a present one.
 */
export function resolveDefaultsDir(
  vendored: string | undefined,
  packaged: string | undefined,
  vendoredIsStale: boolean,
): string | undefined {
  if (packaged && vendoredIsStale)
    return packaged

  return vendored ?? packaged
}

function packagedDefaultsDir(sub: string): string | undefined {
  try {
    const packageRoot = dirname(fileURLToPath(import.meta.resolve('@stacksjs/defaults/package.json')))
    const packaged = `${packageRoot}/${sub}`
    return existsSync(packaged) ? packaged : undefined
  }
  catch {
    // @stacksjs/defaults is not installed — there is no fallback to offer.
    return undefined
  }
}

/**
 * Memoised: `frameworkDefaultsDir` is called once per scanned directory on the
 * boot path, and the answer cannot change without a restart.
 */
let defaultsAreStale: boolean | undefined
function vendoredDefaultsAreStale(): boolean {
  if (defaultsAreStale === undefined)
    defaultsAreStale = path.inspectDefaultsProvenance().status === 'stale'

  return defaultsAreStale
}

/** Drop the directories that do not exist, so a scan is never handed one. */
function existingDirs(dirs: (string | undefined)[]): string[] {
  return dirs.filter((dir): dir is string => Boolean(dir) && existsSync(dir as string))
}

/**
 * Resolve the set of directories to scan for framework-default models.
 * Always returns the Models root itself (for top-level files), then includes
 * each opt-in subdir only if its gating config file exists in the project.
 */
function resolveDefaultModelDirs(): string[] {
  const root = frameworkDefaultsDir('app/Models')
  if (!root)
    return []

  const dirs = [root]
  for (const [subdir, configPaths] of Object.entries(OPTIONAL_MODEL_MODULES)) {
    if (configEnabled(configPaths))
      dirs.push(`${root}/${subdir}`)
  }
  return dirs
}

/**
 * Non-recursive scan of a single directory's direct `.ts` children.
 * Used for both root-level and opt-in subdir scanning so that e.g. disabling
 * commerce correctly excludes `commerce/**` even if the directory exists.
 */
function scanDirTopLevel(dir: string): string[] {
  try {
    return globSync(`${dir}/*.ts`, { ignore: ['**/*.d.ts', '**/index.ts', '**/README*'] })
  }
  catch {
    return []
  }
}

/**
 * Scan defineModel()-based model definition files (export default).
 * These files export their model as the default export.
 *
 * When `recursive` is false, only direct children are scanned — used for the
 * framework defaults root so that opt-in subdirs don't leak in unless the
 * caller explicitly includes them.
 */
function scanDefineModelExports(dir: string, opts: { recursive?: boolean } = {}): ExportInfo[] {
  const { recursive = true } = opts
  let files: string[] = []
  try {
    const pattern = recursive ? `${dir}/**/*.ts` : `${dir}/*.ts`
    files = globSync(pattern, { ignore: ['**/*.d.ts', '**/index.ts', '**/README*'] })
  }
  catch {
    return []
  }

  const exports: ExportInfo[] = []
  const seen = new Set<string>()

  for (const file of files) {
    const basename = file.split('/').pop()?.replace('.ts', '') || ''
    if (basename && !seen.has(basename)) {
      seen.add(basename)
      exports.push({ name: basename, file, isDefault: true })
    }
  }

  return exports
}

// Names that would shadow built-in JavaScript globals if injected into
// globalThis. Skip them at codegen so `instanceof Error` / `instanceof Request`
// / `new Response(...)` keep working inside user actions. Users who need the
// underlying model can still import it directly by file path.
const GLOBAL_SHADOW_BLOCKLIST = new Set([
  'Error',
  'Request',
  'Response',
  'URL',
  'Map',
  'Set',
  'Object',
  'Array',
  'Number',
  'String',
  'Date',
  'Promise',
  'Symbol',
])

/**
 * Generate a runtime index file for defineModel() models.
 * These use `export default defineModel(...)`, so we re-export each default as a named export.
 *
 * Each entry is either a plain string (recursive scan) or `{ dir, recursive: false }`
 * for non-recursive scans. The defaults root passes the non-recursive form so
 * that feature-module subdirs (commerce/, Content/, …) only ship when the
 * project opted into them via config.
 */
type ScanEntry = string | { dir: string, recursive: boolean }

async function generateDefineModelIndex(entries: ScanEntry[], outputPath: string): Promise<void> {
  const lines: string[] = ['// Generated by bun-plugin-auto-imports']
  const seen = new Set<string>()

  for (const entry of entries) {
    const dir = typeof entry === 'string' ? entry : entry.dir
    const recursive = typeof entry === 'string' ? true : entry.recursive
    let files: string[] = []
    try {
      const pattern = recursive ? `${dir}/**/*.ts` : `${dir}/*.ts`
      files = globSync(pattern, { ignore: ['**/*.d.ts', '**/index.ts', '**/README*'] })
    }
    catch {
      continue
    }

    for (const file of files) {
      const basename = file.split('/').pop()?.replace('.ts', '') || ''
      if (!basename || seen.has(basename))
        continue
      seen.add(basename)
      const relativePath = relative(dirname(outputPath), file).replace(/\.ts$/, '')
      if (GLOBAL_SHADOW_BLOCKLIST.has(basename)) {
        lines.push(`// Skipped '${basename}' - would shadow a built-in global. Import directly if needed.`)
        lines.push(`// export { default as ${basename} } from '${relativePath}'`)
        continue
      }
      lines.push(`export { default as ${basename} } from '${relativePath}'`)
    }
  }

  await Bun.write(outputPath, lines.join('\n') + '\n')
}

/**
 * Generate a runtime index of NAME to FILE PATH.
 *
 * The eager `generateDefineModelIndex` above re-exports every default, which is
 * right for models and jobs (they go on `globalThis`, so they have to be
 * evaluated) and wrong for the several hundred actions - loading all of them at
 * boot to be able to route to one is not a trade anyone would make.
 *
 * A map of PATHS rather than of `() => import(...)` thunks, and that is the
 * load-bearing detail. Both give the resolver what it needs; only one is free
 * to read as a type. `typeof import(barrel)` on a barrel of import thunks makes
 * the compiler resolve all 700 modules, which drags the entire action graph -
 * and the files the project deliberately excludes from its programs - into
 * every compilation that touches an action name. A map of string literals
 * costs nothing.
 *
 * This is what lets the name types be DERIVED rather than generated. A union of
 * action paths cannot be written by hand and cannot be read off the filesystem
 * by TypeScript, so it used to be emitted into a 1500-line
 * `storage/framework/types/actions.d.ts` that was correct only until somebody
 * added a file without re-running `buddy generate:types`. `keyof` over this map
 * is the same list the resolver reads, so there is nothing left to keep in
 * agreement.
 *
 * Keys are the path under the scanned root, without the extension, optionally
 * prefixed (`Actions/Auth/LoginAction`). Values are relative to this file, so
 * the map survives the project being moved or deployed. The first directory
 * that has a given key wins, which is what makes `app/` override the framework
 * defaults.
 */
async function generatePathIndex(
  entries: ScanEntry[],
  outputPath: string,
  options: { exportName: string, prefix?: string, extensions?: string[] },
): Promise<void> {
  const prefix = options.prefix ?? ''
  // In preference order: the first extension that exists for a name wins, the
  // same way `resolveTemplatePath` prefers `.stx` over `.html`.
  const extensions = options.extensions ?? ['.ts']
  const found = new Map<string, string>()

  for (const entry of entries) {
    const dir = typeof entry === 'string' ? entry : entry.dir
    const recursive = typeof entry === 'string' ? true : entry.recursive
    let files: string[] = []
    try {
      for (const extension of extensions) {
        const pattern = recursive ? `${dir}/**/*${extension}` : `${dir}/*${extension}`
        files.push(...globSync(pattern))
      }
    }
    catch {
      continue
    }

    /*
     * Extension preference first, then a plain byte comparison.
     *
     * `welcome.stx` has to be seen before `welcome.html` so it claims the key,
     * which is the order `resolveTemplatePath` probes in. The tiebreak is `<`
     * rather than `localeCompare`, which is locale-dependent: the same
     * directory produced a different file order on two machines, so the
     * committed map churned for no reason.
     */
    const rank = (file: string): number => extensions.findIndex(extension => file.endsWith(extension))
    files = files.sort((left, right) => {
      const byRank = rank(left) - rank(right)
      if (byRank !== 0)
        return byRank

      return left < right ? -1 : left > right ? 1 : 0
    })

    /*
     * Filtered here rather than through the glob's `ignore`, which did not
     * exclude them: `Actions/Auth/token-request.test` and 40-odd siblings
     * landed in the map, and every one of them is a legal action path the
     * moment the type is `keyof` over it. The old generated union had the same
     * entries for the same reason.
     */
    for (const file of files) {
      const basename = file.split('/').pop() ?? ''
      if (basename.endsWith('.d.ts') || basename.endsWith('.test.ts') || basename.endsWith('.spec.ts') || basename === 'index.ts')
        continue

      const extension = extensions.find(candidate => file.endsWith(candidate)) ?? ''
      const key = prefix + relative(dir, file).slice(0, extension.length ? -extension.length : undefined)
      if (found.has(key))
        continue
      found.set(key, relative(dirname(outputPath), file))
    }
  }

  const lines = [
    '// Generated by bun-plugin-auto-imports',
    '//',
    '// Name to file, relative to this file. The resolvers read it, and the name',
    '// types are `keyof` over it - so a name that type-checks is a name that',
    '// resolves. Values are paths rather than import thunks on purpose: thunks',
    '// would make every compilation that touches a name resolve every module.',
    `export const ${options.exportName} = {`,
    ...[...found.entries()].map(([key, file]) => `  '${key}': '${file}',`),
    '} as const',
    '',
  ]

  await Bun.write(outputPath, lines.join('\n'))
}

/**
 * Every directory the auto-import manifest is generated from.
 *
 * Shared by the generator and the staleness check below so the two can
 * never disagree about what the manifest is derived from.
 */
export function autoImportSourceDirs(): string[] {
  return existingDirs([
    path.resourcesPath('functions'),
    frameworkDefaultsDir('functions'),
    path.userModelsPath(),
    ...resolveDefaultModelDirs(),
    path.userJobsPath(),
    frameworkDefaultsDir('app/Jobs'),
    path.userControllersPath(),
    frameworkDefaultsDir('app/Controllers'),
    // The name registries. Left out, and the barrel that names an action or a
    // policy would go stale exactly the way the generated `actions.d.ts` it
    // replaces used to: correct until somebody adds a file.
    path.appPath('Actions'),
    frameworkDefaultsDir('app/Actions'),
    path.appPath('Listeners'),
    frameworkDefaultsDir('app/Listeners'),
    path.appPath('Policies'),
    frameworkDefaultsDir('app/Policies'),
    path.appPath('Middleware'),
    frameworkDefaultsDir('app/Middleware'),
    path.resourcesPath('emails'),
    frameworkDefaultsDir('resources/emails'),
  ])
}

/**
 * Has anything the manifest is built from changed since it was written?
 *
 * The manifest used to be regenerated only when it was missing, so once
 * written it never refreshed. Files moved, were renamed, or were deleted
 * underneath it and the stale entries survived: a project on a
 * months-old manifest carried exports pointing at paths that no longer
 * existed, plus duplicates when a file was moved into a subdirectory of
 * the same name (`functions/commerce/products.ts` becoming
 * `functions/commerce/products/products.ts` produced two `useProducts`
 * exports and the `Cannot export a duplicate name` warning on every boot).
 *
 * Regenerating unconditionally is not the alternative: a watcher on the
 * auto-imports directory sees the write, restarts, writes again, and the
 * dev server loops. Comparing mtimes only writes when something actually
 * moved, and the manifest is the newest file afterwards, so the next boot
 * is a no-op and the loop cannot start.
 */
export function autoImportsAreStale(): boolean {
  const manifest = path.storagePath('framework/auto-imports/functions.ts')
  if (!existsSync(manifest))
    return true

  let manifestTime: number
  try {
    manifestTime = statSync(manifest).mtimeMs
  }
  catch {
    return true
  }

  // Directory mtimes catch adds, renames, and deletes; file mtimes catch
  // edits to a file's exports. A source newer than the manifest means the
  // manifest is describing a tree that has since changed.
  for (const dir of autoImportSourceDirs()) {
    if (!existsSync(dir))
      continue

    try {
      if (statSync(dir).mtimeMs > manifestTime)
        return true

      for (const file of globSync(`${dir}/**/*.ts`, { ignore: ['**/*.d.ts'] })) {
        if (statSync(file).mtimeMs > manifestTime)
          return true
      }
    }
    catch {
      // An unreadable source directory is not a reason to regenerate on
      // every boot; the next successful read will catch any real change.
      continue
    }
  }

  return false
}

/**
 * Generate runtime auto-import files for Bun runtime execution.
 * This creates index files that can be imported to get all auto-imports,
 * including defineModel()-based model definitions and resource functions.
 */
export async function generateAutoImportFiles(): Promise<void> {
  const userFunctionsPath = path.resourcesPath('functions')
  // Framework-default functions (e.g. defaults/functions/commerce/coupons.ts →
  // useCoupons) are also auto-importable so dashboard pages can call them
  // without an explicit `import` line. User functions come first so a
  // project-level helper of the same name shadows the default.
  const defaultFunctionsPath = frameworkDefaultsDir('functions')
  const functionsPath = userFunctionsPath
  const outputDir = path.storagePath('framework/auto-imports')

  // defineModel() model definition directories. User models override framework
  // defaults. The legacy storage/framework/models/ cache has been removed —
  // models are imported directly from their canonical source (user or defaults).
  const userModelsPath = path.userModelsPath()
  const defaultModelDirs = resolveDefaultModelDirs()
  const [defaultsRoot, ...enabledSubdirs] = defaultModelDirs

  // Job definition directory
  const userJobsPath = path.userJobsPath()

  // Controller definition directories (user controllers take priority)
  const userControllersPath = path.userControllersPath()
  const defaultControllersPath = frameworkDefaultsDir('app/Controllers')

  // Ensure output directory exists
  await Bun.write(`${outputDir}/.gitkeep`, '')

  // Generate runtime index for functions.
  //
  // Filtered to directories that exist, because generateRuntimeIndex throws on
  // one that does not. That covers the framework defaults an app consuming the
  // packages may not have on disk, and equally `resources/functions` in a
  // project that simply has no functions of its own — which used to be a boot
  // failure for a reason nobody could act on.
  const functionsIndexPath = `${outputDir}/functions.ts`
  await (generateRuntimeIndex as any)(existingDirs([userFunctionsPath, defaultFunctionsPath]), functionsIndexPath)

  // Generate runtime index for defineModel models (default exports).
  // Defaults root is scanned NON-recursively (so gated subdirs stay opt-in),
  // each enabled module subdir is then added explicitly.
  const modelsIndexPath = `${outputDir}/models.ts`
  const modelScan: ScanEntry[] = [
    userModelsPath,
    ...(defaultsRoot ? [{ dir: defaultsRoot, recursive: false }] : []),
    ...defaultModelDirs.slice(1).map(d => ({ dir: d, recursive: true })),
  ]
  await generateDefineModelIndex(modelScan, modelsIndexPath)

  // Generate runtime index for jobs (default exports, same pattern as models).
  //
  // The framework defaults are scanned too, which they were not: models and
  // controllers both took `[user, defaults]` and jobs took `[user]` alone. So
  // the nine jobs Stacks ships were absent from the barrel while
  // `resolveJobFile` resolved every one of them - which made them unschedulable
  // by type and un-auto-imported at runtime, for no reason anyone chose.
  const jobsIndexPath = `${outputDir}/jobs.ts`
  await generateDefineModelIndex(existingDirs([userJobsPath, frameworkDefaultsDir('app/Jobs')]), jobsIndexPath)

  /*
   * Lazy indexes: the name-addressed registries.
   *
   * Actions, listeners, policies and middleware are all resolved by NAME at
   * runtime - out of a route string, an `app/Events.ts` entry, an
   * `app/Gates.ts` mapping, a `.middleware(...)` call - and every one of those
   * names used to be `string` to the compiler, with a generated `.d.ts` union
   * bolted on beside it that drifted the moment a file was added.
   *
   * One lazy map each, instead. The resolvers read it, `keyof` types it, and
   * because it is the same object there is nothing left to keep in agreement.
   */
  await generatePathIndex(
    existingDirs([path.appPath('Actions'), frameworkDefaultsDir('app/Actions')]),
    `${outputDir}/actions.ts`,
    { exportName: 'actions', prefix: 'Actions/' },
  )

  await generatePathIndex(
    existingDirs([path.appPath('Listeners'), frameworkDefaultsDir('app/Listeners')]),
    `${outputDir}/listeners.ts`,
    { exportName: 'listeners' },
  )

  await generatePathIndex(
    existingDirs([path.appPath('Policies'), frameworkDefaultsDir('app/Policies')]),
    `${outputDir}/policies.ts`,
    { exportName: 'policies' },
  )

  await generatePathIndex(
    existingDirs([path.appPath('Middleware'), frameworkDefaultsDir('app/Middleware')]),
    `${outputDir}/middleware.ts`,
    { exportName: 'middleware' },
  )

  // Email templates are named the same way and resolved the same way, with two
  // extensions instead of one and `.stx` preferred - which is exactly the order
  // `resolveTemplatePath` probes them in.
  await generatePathIndex(
    existingDirs([path.resourcesPath('emails'), frameworkDefaultsDir('resources/emails')]),
    `${outputDir}/emails.ts`,
    { exportName: 'emails', extensions: ['.stx', '.html'] },
  )

  // Generate runtime index for controllers (default exports, user overrides defaults)
  const controllersIndexPath = `${outputDir}/controllers.ts`
  await generateDefineModelIndex(existingDirs([userControllersPath, defaultControllersPath]), controllersIndexPath)

  // Generate combined index
  const combinedContent = `// Generated by bun-plugin-auto-imports
export * from './functions'
export * from './models'
export * from './jobs'
export * from './controllers'
`
  await Bun.write(`${outputDir}/index.ts`, combinedContent)

  // Generate globals injection script
  const globalsPath = `${outputDir}/globals.ts`
  await generateGlobalsScript(
    [functionsPath],
    globalsPath,
    `${outputDir}/index.ts`,
  )

  /*
   * The global declarations LAST, because they are read off the barrels above.
   * This used to run first, back when it scanned the source directories itself
   * - which is exactly how it came to describe a different set than the one
   * that gets injected.
   */
  await generateServerAutoImportTypes()

  // The browser declaration is pruned rather than written: which names are
  // ambient in a template is the stx plugin's decision, and it does not export
  // that list. What can be established here is that a declared name resolves.
  const pruned = await pruneBrowserAutoImportTypes()
  if (pruned.length > 0)
    log.debug(`[auto-imports] dropped ${pruned.length} browser globals that resolve to nothing`)

  log.debug('Auto-import files generated successfully')
}

/**
 * Initialize auto-imports for both bundler and runtime.
 *
 * Scans defineModel() model files and resource functions, making them
 * available globally without explicit imports.
 */
export function initiateImports(): void {
  const functionsPath = path.resourcesPath('functions')
  // Framework-default helpers (`defaults/functions/...`) are also surfaced
  // globally so dashboard pages can call `useCoupons()`, `useCustomers()`,
  // etc. without an explicit import.
  const defaultFunctionsPath = frameworkDefaultsDir('functions')

  // defineModel() model definition directories (user models take priority).
  // Defaults root is non-recursive so opt-in subdirs must be explicitly added.
  const userModelsPath = path.userModelsPath()
  const defaultModelDirs = resolveDefaultModelDirs()
  const [defaultsRoot, ...enabledSubdirs] = defaultModelDirs

  // Job definition directory
  const userJobsPath = path.userJobsPath()

  // Controller definition directories
  const userControllersPath = path.userControllersPath()
  const defaultControllersPath = frameworkDefaultsDir('app/Controllers')

  // Scan defineModel() models (default exports from model definitions)
  const defineModelExports = [
    ...scanDefineModelExports(userModelsPath),
    ...(defaultsRoot ? scanDefineModelExports(defaultsRoot, { recursive: false }) : []),
    ...enabledSubdirs.flatMap(d => scanDefineModelExports(d)),
  ]

  // Scan job definitions (default exports, same pattern as models)
  const jobExports = scanDefineModelExports(userJobsPath)

  // Deduplicate: user models override framework models override defaults
  const seen = new Set<string>()
  const uniqueDefineModelExports = defineModelExports.filter(exp => {
    if (seen.has(exp.name)) return false
    seen.add(exp.name)
    return true
  })

  // Build imports array for defineModel models (import default as ModelName)
  // Use relative paths from the .d.ts output directory for portability
  const dtsDir = dirname(path.storagePath('framework/types/server-auto-imports.d.ts'))
  const defineModelImports = uniqueDefineModelExports.map(exp => ({
    from: `./${relative(dtsDir, exp.file).replace(/\\/g, '/').replace(/\.ts$/, '')}`,
    name: 'default',
    as: exp.name,
  }))

  // Build imports array for jobs (import default as JobName)
  const jobImports = jobExports.map(exp => ({
    from: `./${relative(dtsDir, exp.file).replace(/\\/g, '/').replace(/\.ts$/, '')}`,
    name: 'default',
    as: exp.name,
  }))

  // Scan controller definitions (default exports, user overrides defaults)
  const controllerExports = [
    ...scanDefineModelExports(userControllersPath),
    ...(defaultControllersPath ? scanDefineModelExports(defaultControllersPath) : []),
  ]
  const seenControllers = new Set<string>()
  const uniqueControllerExports = controllerExports.filter(exp => {
    if (seenControllers.has(exp.name)) return false
    seenControllers.add(exp.name)
    return true
  })
  const controllerImports = uniqueControllerExports.map(exp => ({
    from: `./${relative(dtsDir, exp.file).replace(/\\/g, '/').replace(/\.ts$/, '')}`,
    name: 'default',
    as: exp.name,
  }))

  const options: AutoImportsOptions = {
    dts: path.storagePath('framework/types/server-auto-imports.d.ts'),
    imports: [
      ...primitiveAutoImportEntries(),
      ...defineModelImports,
      ...jobImports,
      ...controllerImports,
    ],
    // Use dirs to auto-scan and import all exports from resources/functions
    // (user) plus the framework defaults' functions, wherever they resolve.
    dirs: existingDirs([functionsPath, defaultFunctionsPath]),
    eslint: {
      enabled: true,
      filepath: path.storagePath('framework/server-auto-imports.json'),
    },
  }

  // Register bundler plugin (for Bun bundler)
  plugin(autoImports(options))

  // Generate runtime files — fire-and-forget but log errors visibly
  generateAutoImportFiles().catch(err => {
    console.error('[Server] Failed to generate auto-import files:', err)
  })
}

/** Generate TypeScript declarations for the globals injected by the server. */
export async function generateServerAutoImportTypes(): Promise<void> {
  /*
   * Read from the BARRELS, not by scanning the directories a second time.
   *
   * `injectGlobalAutoImports` puts a name on `globalThis` by importing
   * `auto-imports/{models,jobs,controllers}.ts` and assigning what comes out.
   * This file declares what is there. Two independent scans of the same
   * directories are two chances to disagree, and they did: the barrels took
   * user + defaults for models and controllers, and this took user + defaults
   * for models and controllers and user ONLY for jobs - so every job the
   * framework ships was a global at runtime with no type at all.
   *
   * There is nothing to keep in step now. What the barrel exports is what gets
   * injected and what gets declared, because it is one list read once.
   */
  const seen = new Set<string>()
  const valueExports = [
    // The barrels first, so a user model is described by its own file rather
    // than by the framework's lazy proxy of the same name.
    ...barrelExports('models'),
    ...barrelExports('jobs'),
    ...barrelExports('controllers'),
    // Then the models `@stacksjs/orm` puts on `globalThis` itself. These are
    // lazy proxies for the COMPLETE framework model surface, injected whether
    // or not the feature module that owns them is enabled - so they are global
    // even when the barrel, which is feature-gated, does not carry them.
    // Leaving them out would type `Post` as unknown in an app that has not
    // enabled the CMS, where `await Post.all()` works.
    ...(await ormModelGlobals()),
  ]
    .filter(exp => !GLOBAL_SHADOW_BLOCKLIST.has(exp.name))
    .filter((exp) => {
      if (seen.has(exp.name)) return false
      seen.add(exp.name)
      return true
    })

  const outputPath = path.storagePath('framework/types/server-auto-imports.d.ts')
  const outputDir = dirname(outputPath)
  const declaredValues = new Set(valueExports.map(exp => exp.name))
  const lines = [
    '// Generated by Stacks server auto-imports',
    '// This file is regenerated automatically when the API starts.',
    'export {}',
    'declare global {',
  ]

  for (const { from, name, as } of primitiveAutoImportEntries()) {
    if (!declaredValues.has(as))
      lines.push(`  const ${as}: typeof import('${from}')['${name}']`)
  }

  for (const exp of valueExports) {
    // A package specifier is used as written; a file is made relative to this
    // declaration. The ORM's proxies are typed through the package, because
    // that is the module a caller's `Post` actually came from.
    if (!exp.isDefault) {
      lines.push(`  const ${exp.name}: typeof import('${exp.file}')['${exp.name}']`)
      continue
    }

    const importPath = relative(outputDir, exp.file).replace(/\\/g, '/').replace(/\.ts$/, '')
    const relativePath = importPath.startsWith('.') ? importPath : `./${importPath}`
    lines.push(`  const ${exp.name}: typeof import('${relativePath}')['default']`)
  }

  lines.push('}', '')
  await Bun.write(outputPath, lines.join('\n'))

  /*
   * The eslint globals manifest, from the same filtered list.
   *
   * It is written here rather than left to the bundler plugin for two reasons,
   * both learned the hard way. The plugin only writes it when the server boots,
   * so the committed copy had drifted to listing 176 names that exist under no
   * scheme - `AuthorModel`, `AuthorRequest`, `AuthorRequestModel` for every
   * model - while missing 387 that do. And the plugin does not apply
   * `GLOBAL_SHADOW_BLOCKLIST`, so letting it write meant `Error` and `Request`
   * being announced as globals when the barrel deliberately does not inject
   * them.
   *
   * Deriving both files from one list is what makes them agree by construction
   * rather than by whoever ran last.
   */
  const globals: Record<string, true> = {}
  for (const { as } of primitiveAutoImportEntries()) {
    if (!declaredValues.has(as))
      globals[as] = true
  }
  for (const exp of valueExports)
    globals[exp.name] = true

  await Bun.write(
    path.storagePath('framework/server-auto-imports.json'),
    `${JSON.stringify({ globals: Object.fromEntries(Object.keys(globals).sort().map(k => [k, true])) }, null, 2)}\n`,
  )
}

/**
 * The names a generated barrel exports, and where each one comes from.
 *
 * Parsed from the file's text rather than imported: this runs during
 * generation, when the barrel may have just been rewritten, and importing it
 * would serve the previous version out of the module cache. Both forms the
 * generators emit are read - the eager `export { default as X } from '...'`
 * and the commented-out line the shadow blocklist leaves behind, which is
 * skipped because it is not an export.
 */
function barrelExports(barrel: 'models' | 'jobs' | 'controllers'): ExportInfo[] {
  const file = path.storagePath(`framework/auto-imports/${barrel}.ts`)

  if (!existsSync(file))
    return []

  const source = readFileSync(file, 'utf8')
  const outputDir = dirname(file)
  const found: ExportInfo[] = []

  for (const line of source.split('\n')) {
    const match = /^export \{ default as (\w+) \} from '([^']+)'/.exec(line.trim())
    if (!match)
      continue

    const [, name, relativePath] = match
    found.push({ name: name!, file: resolvePath(outputDir, `${relativePath!}.ts`), isDefault: true })
  }

  return found
}

/**
 * Drop every browser global that the module beside it does not export.
 *
 * `types/browser-auto-imports.d.ts` tells the compiler which names an stx
 * script block can use bare. It is a committed artifact of
 * `unplugin-auto-import`, which nothing in this repository runs, and it had
 * drifted badly: of 405 declared globals, 291 are not exported by the module
 * named beside them - 229 of those from one file that exports 15. `charIn(...)`
 * type-checks and throws `charIn is not defined`.
 *
 * It survived because the file opens with `@ts-nocheck`, so every
 * `typeof import(...)['name']` in it went unchecked. A declaration nothing
 * checks is believed by everything.
 *
 * This PRUNES rather than regenerates, deliberately. Which names are ambient in
 * a template is decided by the stx plugin, and stx does not export that list -
 * so "every export of these modules" would be a different set, roughly three
 * times larger, announcing globals the runtime does not inject. Removing the
 * ones that provably resolve to nothing needs no such guess.
 *
 * Returns the names removed.
 */
export async function pruneBrowserAutoImportTypes(): Promise<string[]> {
  const outputPath = path.storagePath('framework/types/browser-auto-imports.d.ts')

  if (!existsSync(outputPath))
    return []

  const source = readFileSync(outputPath, 'utf8')
  const outputDir = dirname(outputPath)
  const exportsOf = new Map<string, Set<string> | null>()

  async function moduleExports(specifier: string): Promise<Set<string> | null> {
    const cached = exportsOf.get(specifier)
    if (cached !== undefined)
      return cached

    let names: Set<string> | null
    try {
      const resolved = specifier.startsWith('.') ? resolvePath(outputDir, specifier) : specifier
      names = new Set(Object.keys(await import(resolved) as Record<string, unknown>))
    }
    catch {
      // A module this install cannot resolve is left alone: absent is not the
      // same as "does not export it", and pruning on that would delete
      // declarations that are correct wherever the module IS installed.
      names = null
    }

    exportsOf.set(specifier, names)

    return names
  }

  const removed: string[] = []
  const kept: string[] = []

  for (const line of source.split('\n')) {
    const match = /^ {2}const (\w+): typeof import\('([^']+)'\)\['(\w+)'\]/.exec(line)

    if (!match) {
      kept.push(line)
      continue
    }

    const [, declaredAs, specifier, exported] = match
    const names = await moduleExports(specifier!)

    if (names && !names.has(exported!)) {
      removed.push(declaredAs!)
      continue
    }

    kept.push(line)
  }

  if (removed.length === 0)
    return []

  // `@ts-nocheck` goes with them. It is what let the file declare names that
  // resolve to nothing, and keeping it would let the next 291 in. The
  // provenance line goes too: `unplugin-auto-import` has not written this file
  // in a long time, and a header naming a tool nobody runs is why nobody
  // thought to check it.
  const pruned = kept
    .filter(line => line.trim() !== '// @ts-nocheck')
    .map(line => line.trim() === '// Generated by unplugin-auto-import'
      ? '// Pruned by Stacks: every name below is exported by the module beside it.'
      : line)
    .join('\n')

  await Bun.write(outputPath, pruned)

  const globals = [...pruned.matchAll(/^ {2}const (\w+):/gm)].map(match => match[1]!).sort()
  await Bun.write(
    path.storagePath('framework/browser-auto-imports.json'),
    `${JSON.stringify({ globals: Object.fromEntries(globals.map(name => [name, true])) }, null, 2)}\n`,
  )

  return removed
}

/**
 * The model names `@stacksjs/orm` injects onto `globalThis` as lazy proxies.
 *
 * Read from the package rather than restated here, and typed through the
 * package rather than through a file path: `typeof import('@stacksjs/orm')[X]`
 * is the proxy's own type, which is what a caller actually gets.
 *
 * Best-effort. An install without the ORM simply contributes nothing, which
 * leaves the barrel-derived half exactly as it was.
 */
async function ormModelGlobals(): Promise<ExportInfo[]> {
  try {
    const { modelGlobalNames } = await import('@stacksjs/orm') as { modelGlobalNames?: readonly string[] }

    return (modelGlobalNames ?? []).map(name => ({ name, file: '@stacksjs/orm', isDefault: false }))
  }
  catch {
    return []
  }
}

/**
 * Import and inject all auto-imports into globalThis for runtime access.
 * Call this early in your application startup.
 *
 * This makes all models, plus framework primitives used by actions
 * (Action, response, schema, Auth), available globally, matching the
 * "no imports needed" ergonomics of framework default actions.
 */
export async function injectGlobalAutoImports(): Promise<void> {
  // Idempotency guard. Bun's hot-reload re-evaluates this module on every
  // file change; without this guard each cycle would re-`Object.assign` the
  // primitive bundle onto globalThis, which is fine for replacements but
  // causes the auto-import barrel re-eval to leak duplicates of every
  // user model/job/controller into the global namespace and slowly bloat
  // the dev process. Once is enough.
  if ((globalThis as { __stacksAutoImportsInjected?: boolean }).__stacksAutoImportsInjected) return
  ;(globalThis as { __stacksAutoImportsInjected?: boolean }).__stacksAutoImportsInjected = true

  const errors: Error[] = []

  // Framework primitives FIRST. User models, jobs, mail classes, etc. read
  // these at module-evaluation time — `schema.number()` in a model's
  // attribute definition, `mail.send(...)` in a job, `class Foo extends
  // Controller` in a controller. If we loaded the auto-imports barrel before
  // these, any user file in that barrel would resolve `schema` / `Controller`
  // / `defineModel` against a still-evaluating namespace and trigger TDZ.
  // Listing primitives here gives every framework user the same "no imports"
  // ergonomics that framework defaults already enjoy. Type-only symbols
  // (UserModel, Attributes, CLI, Events, …) remain available through the
  // framework's static type declarations without polluting runtime.
  // Per-package timeout so a single misbehaving module (e.g. one that opens
  // a Redis socket at module-eval time) doesn't deadlock dev startup.
  // Anything that doesn't load in 4s gets logged and skipped — the package
  // can still be reached via explicit `import` from user code.
  const importWithTimeout = async (pkg: string) => {
    return Promise.race([
      import(pkg),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`auto-import timed out: ${pkg}`)), 4000),
      ),
    ])
  }

  // Import every primitive concurrently. They're independent packages that
  // export distinct global names, so the order they resolve in doesn't matter —
  // only that all of them land on globalThis before the user barrel loads (the
  // await below). Parallelizing overlaps their module I/O instead of paying for
  // each import end-to-end in sequence.
  await Promise.all(primitiveModules.map(async ([pkg, names]) => {
    try {
      const mod = await importWithTimeout(pkg)
      for (const name of names) {
        if (mod[name] !== undefined)
          (globalThis as any)[name] = mod[name]
      }
    }
    catch (err) {
      errors.push(err as Error)
    }
  }))

  // Project `locales/*.yml` — used by STX `{{ t('key') }}` and actions.
  try {
    const { ensureLocalesLoaded } = await import('@stacksjs/i18n')
    await ensureLocalesLoaded()
  }
  catch (err) {
    errors.push(err as Error)
  }

  // Now that every framework primitive is fully evaluated and globalThis-ed,
  // it's safe to load the user's auto-import barrel: models can read
  // `schema`, jobs can read `mail`, controllers can extend `Controller`,
  // etc. without hitting a TDZ caused by mid-evaluation namespace access.
  // Each barrel is loaded separately, not through the combined `index.ts`.
  //
  // `index.ts` re-exports all four with `export *`, so a single duplicate name
  // in any one of them makes the whole module fail to link and NOTHING reaches
  // globalThis — every model, job and controller in the project disappears at
  // once. That is how an app ended up with `HtrSample is not defined` in its
  // stx views while `functions.ts` merely had `useProducts` exported twice: the
  // generator emitted a name collision between `commerce/products` and
  // `commerce/products/products`, and the only trace was a one-line warning
  // that read like a lint nit rather than "no models exist".
  //
  // Split, a broken barrel costs only its own names. The order matches
  // `index.ts` so shadowing behaviour is unchanged.
  const barrels = ['functions', 'models', 'jobs', 'controllers'] as const
  const injected: string[] = []

  for (const barrel of barrels) {
    const barrelPath = path.storagePath(`framework/auto-imports/${barrel}.ts`)

    if (!existsSync(barrelPath))
      continue

    try {
      const mod = await import(barrelPath)
      Object.assign(globalThis, mod)
      injected.push(barrel)
    }
    catch (err) {
      // Named loudly. The consequence of losing a barrel is not obvious from
      // the linker's message: "Cannot export a duplicate name" says nothing
      // about every model in the app becoming undefined in templates.
      log.warn(
        `[auto-imports] ${barrel}.ts failed to load, so nothing it exports is available. `
        + `Views and actions referencing them will throw "is not defined". Cause: ${(err as Error).message}`,
      )
    }
  }

  // A project with models on disk and none injected is broken in a way that is
  // invisible until a template renders empty, so it is reported up front.
  if (!injected.includes('models') && existsSync(path.storagePath('framework/auto-imports/models.ts')))
    log.warn('[auto-imports] No models were injected. Every model reference in stx views and actions will be undefined.')

  // Listeners last, and after the barrel deliberately: a listener reads models
  // and jobs at module-evaluation time exactly as an action does, so it has to
  // be imported once those are on globalThis.
  //
  // Here rather than in the router because listeners are not an HTTP concern -
  // `buddy seed`, a scheduled job and a console command all dispatch events,
  // and every one of those paths comes through this function. Before this call
  // existed, nothing registered listeners anywhere: `app/Events.ts` was read
  // only by a test, `discoverListeners` was exported and never called, and
  // `dispatch` succeeded into an emitter with no handlers on it.
  try {
    const { registerAppListeners } = await import('@stacksjs/events')
    await registerAppListeners()
  }
  catch (err) {
    errors.push(err as Error)
  }

  // Authorization, for the same reason and in the same place. `app/Gates.ts`
  // was read by `initializeAuthorization()`, which was exported and called by
  // nothing - so every gate an application defined was never registered, and
  // `Gate.allows('access-admin', user)` fell through to the default deny.
  // Fail-closed, so nothing was unguarded; but the whole feature did nothing,
  // and "denies everything" is what a working gate looks like when it says no.
  try {
    const { initializeAuthorization } = await import('@stacksjs/auth')
    await initializeAuthorization()
  }
  catch (err) {
    errors.push(err as Error)
  }

  if (errors.length) {
    // Non-fatal — framework parts the project doesn't install can be missing.
    for (const err of errors)
      console.warn('[auto-imports]', err.message)
  }
}
