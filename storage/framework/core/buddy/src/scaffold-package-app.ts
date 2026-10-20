/**
 * Shaping a new app into a package-based project.
 *
 * `buddy new` downloads this repository, which is both the framework's source
 * and stacksjs.com. `scaffold-site` strips the website and `unvendorCore`
 * swaps `storage/framework/core` for the published packages. What was left
 * over still made every new app's first commit ~3,200 files, almost none of
 * them the app's:
 *
 *   - `storage/framework/defaults`: 2,600-odd files identical to the installed
 *     `@stacksjs/defaults`. Now a gitignored link to that package
 *     ({@link adoptPackagedDefaults}), so `buddy upgrade` has nothing to sync
 *     and nothing can drift.
 *   - `bench/` and the framework's own scripts, tsconfigs and package.json
 *     scripts, which build, benchmark and publish the framework
 *     ({@link pruneFrameworkOnlyFiles}, {@link appPackageScripts}).
 *   - `deps.yml`, a hand-kept copy of `config/deps.ts` that had already drifted
 *     from it. `buddy new` now generates `deps.yaml` from the config instead.
 *
 * Plain filesystem functions, so they can be run against a copy of the real
 * repository in tests.
 */
import { appendFileSync, cpSync, existsSync, lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { linkPackagedDefaults, packagedDefaultsRoot } from '@stacksjs/path'

export const VENDORED_DEFAULTS = 'storage/framework/defaults'

/**
 * Paths in this repository that exist to develop, benchmark or publish the
 * framework itself. Nothing in an app runs them, and several (the publish
 * scripts, `tsconfig.framework.json`) point at `storage/framework/core`, which
 * a new app no longer has.
 *
 * `scaffold-package-app.test.ts` fails if one stops existing in the
 * repository, so a moved file cannot quietly start shipping again.
 */
export const FRAMEWORK_ONLY_PATHS = [
  'bench',
  // Its only setting is `repo: stacksjs/stacks`, which pointed every app's
  // changelog links at the framework. logsmith reads the repo from git without it.
  'logsmith.config.ts',
  'storage/framework/tsconfig.framework.json',
  'storage/framework/tsconfig.defaults.json',
  'storage/framework/tsconfig.type-tests.json',
  // The contributor list for the framework's own docs site.
  'storage/framework/docs',
  'storage/framework/scripts/fresh',
  'storage/framework/scripts/generate-changelog',
  'storage/framework/scripts/install',
  'storage/framework/scripts/link',
  'storage/framework/scripts/lint',
  'storage/framework/scripts/move-built-src-files.ts',
  'storage/framework/scripts/move-dts-files.ts',
  'storage/framework/scripts/normalize-workspace-deps-for-publish',
  'storage/framework/scripts/publish',
  'storage/framework/scripts/publish-commit',
  'storage/framework/scripts/publish-dummy-libs',
] as const

/** Remove {@link FRAMEWORK_ONLY_PATHS}; returns the ones that were there. */
export function pruneFrameworkOnlyFiles(root: string): string[] {
  const removed: string[] = []
  for (const path of FRAMEWORK_ONLY_PATHS) {
    const full = join(root, path)
    if (!existsSync(full))
      continue
    rmSync(full, { recursive: true, force: true })
    removed.push(path)
  }
  return removed
}

/**
 * package.json scripts that only make sense in the framework repository: the
 * benchmarks, the generated-docs and declaration checks (whose scripts live in
 * the framework's `.github/scripts`, which an app does not get), and the
 * framework's own typecheck projects. `buddy release` runs every
 * `docs:*:check` it finds as a pre-flight, so leaving these in made an app's
 * release run the framework's checks.
 */
const FRAMEWORK_ONLY_SCRIPTS = [
  /^bench(?::|$)/,
  /^test:bench$/,
  /^typecheck:(?:bench|framework|type-tests)$/,
  /^docs:/,
  /^declarations:check$/,
  /^deps:lockfile:check$/,
]

/** Scripts an app gets in place of the framework's versions. */
const APP_SCRIPTS: Record<string, string> = {
  // The framework runs its CLI from source; the shim finds the installed one.
  'buddy': './buddy',
  'typecheck': 'bun run typecheck:app',
  'typecheck:app': 'bun x --bun tsc --noEmit -p tsconfig.json --pretty false',
  // The framework's version also checked its own views and the vendored core.
  'typecheck:views': 'bun x --bun stx typecheck --lib storage/framework/types/request-context.d.ts --lib storage/framework/types/browser-composables.d.ts \'resources/**/*.stx\'',
  // The framework's version rebuilt `storage/framework` as a workspace.
  'build:reset': 'rm -rf node_modules && pantry install && ./buddy generate:types && ./buddy lint:fix',
}

export interface ScriptChanges {
  scripts: Record<string, string>
  removed: string[]
  rewritten: string[]
}

export function appPackageScripts(scripts: Record<string, string>): ScriptChanges {
  const next: Record<string, string> = {}
  const removed: string[] = []
  const rewritten: string[] = []

  for (const [name, command] of Object.entries(scripts)) {
    if (FRAMEWORK_ONLY_SCRIPTS.some(pattern => pattern.test(name))) {
      removed.push(name)
      continue
    }

    const replacement = APP_SCRIPTS[name]
    if (replacement !== undefined && replacement !== command) {
      next[name] = replacement
      rewritten.push(name)
      continue
    }

    next[name] = command
  }

  return { scripts: next, removed, rewritten }
}

/**
 * Apply {@link appPackageScripts} to the root package.json, and drop the two
 * scripts in `storage/framework/package.json` that publish the framework.
 */
export function applyAppPackageScripts(root: string): ScriptChanges {
  const file = join(root, 'package.json')
  const empty = { scripts: {}, removed: [], rewritten: [] }
  if (!existsSync(file))
    return empty

  const pkg = JSON.parse(readFileSync(file, 'utf8')) as { scripts?: Record<string, string> }
  const changes = appPackageScripts(pkg.scripts ?? {})
  if (changes.removed.length > 0 || changes.rewritten.length > 0) {
    pkg.scripts = changes.scripts
    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
  }

  const frameworkFile = join(root, 'storage/framework/package.json')
  if (existsSync(frameworkFile)) {
    const framework = JSON.parse(readFileSync(frameworkFile, 'utf8')) as { scripts?: Record<string, string> }
    let touched = false
    for (const [name, command] of Object.entries(framework.scripts ?? {})) {
      if (!/\.\/scripts\/publish|\.\/core\b/.test(command))
        continue
      delete framework.scripts![name]
      touched = true
    }
    if (touched)
      writeFileSync(frameworkFile, `${JSON.stringify(framework, null, 2)}\n`)
  }

  return changes
}

/** Keys that credit the framework or point at its repository. */
const FRAMEWORK_CREDIT_KEYS = ['author', 'contributors', 'funding', 'homepage', 'repository', 'bugs']

/**
 * Strip the framework's author, sponsor link and repository from the
 * workspace manifests an app keeps under `storage/framework` (the root one,
 * `server/`, `cloud/`, `orm/`, `api/` and the library entries). The root
 * package.json already loses them (`appPackageValues`); these said
 * `"funding": "https://github.com/sponsors/chrisbbreuer"` in every app.
 * Returns the manifests it changed.
 */
export function stripFrameworkManifestCredits(root: string): string[] {
  const framework = join(root, 'storage/framework')
  const manifests: string[] = []
  const walk = (dir: string): void => {
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    }
    catch {
      return
    }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      // The vendored framework packages are the framework's own, credits and
      // all; `core` is only still here under --with-core.
      if (entry.isDirectory() && !['core', 'defaults', 'node_modules', 'dist'].includes(entry.name))
        walk(full)
      else if (entry.isFile() && entry.name === 'package.json')
        manifests.push(full)
    }
  }
  walk(framework)

  const touched: string[] = []
  for (const file of manifests) {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    const present = FRAMEWORK_CREDIT_KEYS.filter(key => key in pkg)
    if (present.length === 0)
      continue
    for (const key of present)
      delete pkg[key]
    writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`)
    touched.push(relative(root, file))
  }
  return touched
}

/**
 * Content globs that name a core package's source, which an app does not have.
 * The published package ships the same views under `dist/`.
 */
const CORE_CONTENT_PATHS: Array<{ file: string, from: string, to: string }> = [
  {
    file: 'config/css.ts',
    from: '\'./storage/framework/core/error-handling/src/views/**/*.{stx,html}\'',
    to: '\'./node_modules/@stacksjs/error-handling/dist/views/**/*.{stx,html}\'',
  },
]

export function rewriteCoreContentPaths(root: string): string[] {
  const touched: string[] = []
  for (const { file, from, to } of CORE_CONTENT_PATHS) {
    const full = join(root, file)
    if (!existsSync(full))
      continue
    const raw = readFileSync(full, 'utf8')
    if (!raw.includes(from))
      continue
    writeFileSync(full, raw.replaceAll(from, to))
    touched.push(file)
  }
  return touched
}

/**
 * Give the app the package-layout `storage/framework/tsconfig.app.json`.
 *
 * The repository's own maps every `@stacksjs/*` import onto
 * `storage/framework/core/*\/src`, which a new app does not have. The package
 * variant is what `buddy upgrade` installs anyway (it ships in
 * `@stacksjs/defaults` as `project/storage/framework/tsconfig.app.json`); this
 * gives the app it from the first commit instead of from its first upgrade.
 */
export function applyPackageAppTsconfig(root: string): boolean {
  const source = join(root, 'storage/framework/tsconfig.package-app.json')
  if (!existsSync(source))
    return false

  cpSync(source, join(root, 'storage/framework/tsconfig.app.json'))
  rmSync(source)
  return true
}

/**
 * Directories of the app's own code worth scanning for imports of the defaults
 * tree. `storage` is the tree itself and generated state; the dependency trees
 * are not the app's to edit.
 */
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'pantry', 'dist', 'storage', 'public', '.git', '.cache', '.stx', 'coverage'])
const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.stx'])

function projectSources(dir: string): string[] {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  }
  catch {
    return []
  }

  return entries.flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory())
      return SKIPPED_DIRECTORIES.has(entry.name) ? [] : projectSources(full)
    return entry.isFile() && SCANNED_EXTENSIONS.has(extname(entry.name)) ? [full] : []
  })
}

/**
 * `../storage/framework/defaults/<rest>` or `~/storage/framework/defaults/
 * <rest>` as an import specifier. Anchored on the keyword in front of it, so a
 * path in a comment or a glob string is left alone.
 */
const DEFAULTS_IMPORT = /(\bfrom\s+|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(['"])(?:~\/|(?:\.{1,2}\/)+)storage\/framework\/defaults\/([^'"]+)\2/gm

/**
 * The package specifier for a file in the defaults tree. A `.ts` extension is
 * added when the specifier had none, because the package exports `./*` as-is
 * and neither Bun nor tsc appends one through an `exports` pattern.
 */
export function defaultsSpecifier(rest: string, hasFile: (path: string) => boolean = () => false): string {
  if (!extname(rest) && hasFile(`${rest}.ts`))
    return `@stacksjs/defaults/${rest}.ts`
  return `@stacksjs/defaults/${rest}`
}

/**
 * Point the app's own imports of the defaults tree at `@stacksjs/defaults`.
 *
 * The link keeps the old paths working once it exists, but nothing creates it
 * until the app first boots, and `tsc` never boots it. The package specifier
 * resolves either way: `storage/framework/tsconfig.app.json` maps
 * `@stacksjs/defaults/*` onto the tree and falls back to the package.
 */
export function rewriteDefaultsImports(root: string, hasFile: (path: string) => boolean): string[] {
  const touched: string[] = []

  for (const file of projectSources(root)) {
    const raw = readFileSync(file, 'utf8')
    if (!raw.includes('storage/framework/defaults/'))
      continue

    // A template's script is checked by `stx typecheck`, which rejects a `.ts`
    // extension; Bun resolves the bare path through the package's exports.
    const fileExists = file.endsWith('.stx') ? () => false : hasFile
    const next = raw.replace(DEFAULTS_IMPORT, (_match, lead: string, quote: string, rest: string) =>
      `${lead}${quote}${defaultsSpecifier(rest, fileExists)}${quote}`)

    if (next !== raw) {
      writeFileSync(file, next)
      touched.push(relative(root, file))
    }
  }

  return touched
}

/**
 * Module paths in config that name a file in the tree rather than importing it:
 * the bunfig preloader, and the stx plugin in `config/ui.ts`. Both resolve
 * package specifiers.
 */
/**
 * Spelled with `${TS}` on purpose. The package build rewrites every quoted
 * `./...ts` string to `.js` (it has to, for import specifiers and buddy's lazy
 * command map), and these are paths in the APP's files, not modules of ours:
 * written out in full, 0.75.245 shipped them as `preloader.js` and
 * `stx-components-plugin.js`, matched nothing, and left both pointing at the
 * tree it had just replaced with a link.
 */
const TS = '.ts'

const DEFAULTS_MODULE_PATHS: Array<{ file: string, from: string, to: string }> = [
  {
    file: 'bunfig.toml',
    from: `"./storage/framework/defaults/resources/plugins/preloader${TS}"`,
    to: '"@stacksjs/defaults/resources/plugins/preloader"',
  },
  {
    file: 'config/ui.ts',
    from: `'./storage/framework/defaults/stx-components-plugin${TS}'`,
    to: `'@stacksjs/defaults/stx-components-plugin${TS}'`,
  },
]

export function rewriteDefaultsModulePaths(root: string): string[] {
  const touched: string[] = []
  for (const { file, from, to } of DEFAULTS_MODULE_PATHS) {
    const full = join(root, file)
    if (!existsSync(full))
      continue
    const raw = readFileSync(full, 'utf8')
    if (!raw.includes(from))
      continue
    writeFileSync(full, raw.replaceAll(from, to))
    touched.push(file)
  }
  return touched
}

const GITIGNORE_ENTRY = `/${VENDORED_DEFAULTS}`
const GITIGNORE_BLOCK = `
# The framework defaults: a link to node_modules/@stacksjs/defaults, made on
# boot. \`buddy publish:defaults\` replaces it with a copy you commit instead.
${GITIGNORE_ENTRY}
`

function ignoresDefaults(gitignore: string): boolean {
  return gitignore.split('\n').some(line => line.trim() === GITIGNORE_ENTRY)
}

export function ignoreDefaults(root: string): boolean {
  const file = join(root, '.gitignore')
  const raw = existsSync(file) ? readFileSync(file, 'utf8') : ''
  if (ignoresDefaults(raw))
    return false
  appendFileSync(file, `${raw.endsWith('\n') || raw === '' ? '' : '\n'}${GITIGNORE_BLOCK}`)
  return true
}

export function unignoreDefaults(root: string): boolean {
  const file = join(root, '.gitignore')
  if (!existsSync(file))
    return false
  const raw = readFileSync(file, 'utf8')
  if (!ignoresDefaults(raw))
    return false
  writeFileSync(file, raw.replace(GITIGNORE_BLOCK, '').split('\n').filter(line => line.trim() !== GITIGNORE_ENTRY).join('\n'))
  return true
}

export interface AdoptedDefaults {
  /** The installed package the link points at. */
  packageRoot: string
  /** Whether a vendored directory was removed. */
  removedTree: boolean
  linked: boolean
  rewrittenImports: string[]
  rewrittenModulePaths: string[]
  ignored: boolean
}

/**
 * Stop vendoring the framework defaults: run them from the installed
 * `@stacksjs/defaults` through a gitignored `storage/framework/defaults` link.
 *
 * The caller decides whether the tree is safe to delete. `buddy new` knows it
 * is a pristine download; `buddy unpublish:defaults` compares it with the
 * package first, because an app may have edited a vendored file.
 */
export function adoptPackagedDefaults(root: string): AdoptedDefaults {
  const packageRoot = packagedDefaultsRoot(root)
  if (!packageRoot)
    throw new Error('@stacksjs/defaults is not installed, so there is nothing to run the defaults from. Install the project\'s dependencies first.')

  const tree = join(root, VENDORED_DEFAULTS)
  let removedTree = false
  try {
    const stat = lstatSync(tree)
    if (stat.isDirectory()) {
      rmSync(tree, { recursive: true, force: true })
      removedTree = true
    }
  }
  catch {
    // Not there; the link goes in fresh.
  }

  const hasFile = (path: string) => existsSync(join(packageRoot, path))

  return {
    packageRoot,
    removedTree,
    rewrittenImports: rewriteDefaultsImports(root, hasFile),
    rewrittenModulePaths: rewriteDefaultsModulePaths(root),
    ignored: ignoreDefaults(root),
    linked: linkPackagedDefaults(root),
  }
}
