import type { LibraryConfig, LibraryPackageKind, LibraryPackageOptions } from '@stacksjs/types'
import { relative, resolve } from 'node:path'
import process from 'node:process'
import { componentsPath, functionsPath, libraryPackagePath } from '@stacksjs/path'

/**
 * Raised for a `config/library.ts` that cannot produce a coherent set of
 * packages. Thrown rather than logged-and-exited so the build, generate and
 * publish paths can each decide how loud to be — and so it is testable.
 */
export class LibraryConfigError extends Error {
  override name = 'LibraryConfigError'
}

/**
 * A package definition after normalization, before its sources are matched.
 * Everything here is derivable from config alone, which is what makes the
 * normalization step pure and testable without a filesystem.
 */
export interface LibraryPackageDefinition {
  name: string
  kind: LibraryPackageKind
  /** Directory name under `storage/framework/libs/packages/`. */
  slug: string
  description: string
  keywords: string[]
  license?: string
  version?: string
  private: boolean
  access: 'public' | 'restricted'
  runtime: 'standalone' | 'stx'
  sourcemap: boolean
  include: string[]
  exclude: string[]
  prefix: string
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  /** `source (extensionless, relative to the source dir) -> namespace alias`. */
  aliases: Record<string, string>
  /** `component file stem -> exported/registered name`, from `tags`. */
  names: Record<string, string>
}

/** A definition plus the sources it actually claims on disk. */
export interface ResolvedLibraryPackage extends LibraryPackageDefinition {
  /** `resources/functions` or `resources/components`. */
  sourceDir: string
  /** Absolute paths of the matched sources. */
  sources: string[]
  /** The package directory: `storage/framework/libs/packages/<slug>`. */
  dir: string
  /** The generated entry point. Component libraries generate their own index. */
  entry: string
}

const DEFAULT_FUNCTION_INCLUDE = ['**/*.ts']
const DEFAULT_FUNCTION_EXCLUDE = ['**/*.test.ts', '**/*.spec.ts', '**/*.d.ts', '**/_*.ts']
const DEFAULT_COMPONENT_INCLUDE = ['**/*.stx']
const DEFAULT_COMPONENT_EXCLUDE: string[] = []

/** Where a package of this kind reads its sources from. */
export function libraryPackageSourceDir(kind: LibraryPackageKind): string {
  return kind === 'functions' ? functionsPath() : componentsPath()
}

/** `@acme/ui` -> `ui`. Used for the default slug, prefix and tag namespace. */
export function unscopedName(name: string): string {
  return name.split('/').at(-1) ?? name
}

/**
 * Turn a legacy `files` entry into an include glob.
 *
 * The single-package config accepts `'counter'`, `'counter.ts'`, `'*'` and
 * `['counter', 'fx']`. Only the last carries an alias.
 */
function includeFromFilesEntry(entry: string | string[]): { include: string, alias?: [string, string] } {
  const [file, alias] = Array.isArray(entry) ? entry : [entry, undefined]
  const stem = file.replace(/\.ts$/, '')
  const include = stem === '*' ? '*.ts' : `${stem}.ts`

  return alias ? { include, alias: [stem, alias] } : { include }
}

function toDefinition(option: LibraryPackageOptions, fallback: { license?: string, index: number }): LibraryPackageDefinition {
  const name = option.name?.trim()

  if (!name)
    throw new LibraryConfigError(`library.packages[${fallback.index}] has no name. Every package needs the name it is published under.`)

  if (name.startsWith('.') || name.includes('\\') || name.split('/').length > 2)
    throw new LibraryConfigError(`library.packages[${fallback.index}] has an invalid npm name: "${name}".`)

  const kind = option.kind ?? 'functions'

  if (kind !== 'functions' && kind !== 'components' && kind !== 'web-components')
    throw new LibraryConfigError(`Package "${name}" has an unknown kind "${kind}". Expected 'functions', 'components' or 'web-components'.`)

  const slug = (option.dir ?? unscopedName(name)).replace(/^@/, '')

  if (!/^[\w.-]+$/.test(slug))
    throw new LibraryConfigError(`Package "${name}" resolves to the directory "${slug}", which is not a single safe path segment. Set \`dir\` explicitly.`)

  const aliases: Record<string, string> = {}
  const includeFromFiles: string[] = []

  for (const entry of option.files ?? []) {
    const { include, alias } = includeFromFilesEntry(entry)
    includeFromFiles.push(include)
    if (alias)
      aliases[alias[0]] = alias[1]
  }

  const names: Record<string, string> = {}

  for (const tag of option.tags ?? []) {
    if (Array.isArray(tag.name))
      names[tag.name[0] as string] = tag.name[1] as string
  }

  const defaultInclude = kind === 'functions' ? DEFAULT_FUNCTION_INCLUDE : DEFAULT_COMPONENT_INCLUDE
  const defaultExclude = kind === 'functions' ? DEFAULT_FUNCTION_EXCLUDE : DEFAULT_COMPONENT_EXCLUDE

  // `tags` names components the same way `files` names functions: when it is
  // the only source of truth, it IS the include list. Without this, a config
  // that lists two tags would silently ship every component in the directory.
  const includeFromTags = option.tags?.length && !option.include?.length
    ? option.tags.map(tag => `${Array.isArray(tag.name) ? tag.name[0] : tag.name}.stx`)
    : []

  const include = option.include?.length
    ? option.include
    : includeFromFiles.length
      ? includeFromFiles
      : includeFromTags.length
        ? includeFromTags
        : defaultInclude

  return {
    name,
    kind,
    slug,
    description: option.description ?? `The ${name} library.`,
    keywords: option.keywords ?? [],
    license: option.license ?? fallback.license,
    version: option.version,
    private: option.private ?? false,
    access: option.access ?? 'public',
    runtime: option.runtime ?? 'standalone',
    sourcemap: option.shouldGenerateSourcemap ?? false,
    include,
    exclude: option.exclude ?? defaultExclude,
    prefix: option.prefix ?? unscopedName(name).replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase(),
    dependencies: option.dependencies ?? {},
    peerDependencies: option.peerDependencies ?? {},
    aliases,
    names,
  }
}

/**
 * Read `config/library.ts` into a flat list of package definitions.
 *
 * `packages` is authoritative when present. The older single-package
 * `functions` / `webComponents` keys are normalized into the same shape, so
 * every consumer downstream only ever deals with a list — and a config written
 * before this existed keeps building exactly one package, as it always did.
 */
export function normalizeLibraryPackages(config: LibraryConfig | undefined): LibraryPackageDefinition[] {
  const cfg = config ?? {}
  const options: LibraryPackageOptions[] = []

  if (cfg.packages?.length) {
    options.push(...cfg.packages)
  }
  else {
    if (cfg.functions?.name)
      options.push({ ...cfg.functions, kind: 'functions' })

    if (cfg.webComponents?.name)
      options.push({ ...cfg.webComponents, kind: 'web-components' })
  }

  const definitions = options.map((option, index) => toDefinition(option, { license: cfg.license, index }))

  const byName = new Map<string, number>()
  const bySlug = new Map<string, string>()

  for (const definition of definitions) {
    if (byName.has(definition.name))
      throw new LibraryConfigError(`Two packages are both named "${definition.name}". npm names must be unique.`)

    byName.set(definition.name, 1)

    const owner = bySlug.get(definition.slug)

    if (owner) {
      throw new LibraryConfigError(
        `"${owner}" and "${definition.name}" both build in storage/framework/libs/packages/${definition.slug}. Give one of them a \`dir\`.`,
      )
    }

    bySlug.set(definition.slug, definition.name)
  }

  return definitions
}

/**
 * Match each definition against the files actually present in `resources/`.
 *
 * A package that matches nothing is an error, not an empty package: shipping
 * an empty tarball to npm is worse than failing the build, and a typo'd glob
 * is by far the likeliest cause.
 */
export async function resolveLibraryPackages(
  config: LibraryConfig | undefined,
  options: { onUnmatched?: 'error' | 'skip' } = {},
): Promise<ResolvedLibraryPackage[]> {
  const definitions = normalizeLibraryPackages(config)
  const resolved: ResolvedLibraryPackage[] = []

  for (const definition of definitions) {
    const sourceDir = libraryPackageSourceDir(definition.kind)
    const sources = await matchSources(sourceDir, definition.include, definition.exclude)

    if (!sources.length) {
      // `skip` exists for the release path. The framework defaults always name
      // a `functions` package, so an app that never added one would otherwise
      // have every release blocked by a library it does not have.
      if (options.onUnmatched === 'skip')
        continue

      throw new LibraryConfigError(
        `Package "${definition.name}" matched no files in ${relative(process.cwd(), sourceDir)} `
        + `(include: ${definition.include.join(', ')}${definition.exclude.length ? `; exclude: ${definition.exclude.join(', ')}` : ''}).`,
      )
    }

    resolved.push({
      ...definition,
      sourceDir,
      sources,
      dir: libraryPackagePath(definition.slug),
      entry: libraryPackagePath(definition.slug, 'src/index.ts'),
    })
  }

  return resolved
}

/**
 * Expand the include/exclude globs against the source directory.
 *
 * `Bun.Glob` is scanned per pattern with the source directory as its cwd,
 * rather than handing absolute patterns to the shared glob helper: that helper
 * returns nothing for a pattern with no wildcard in it, so an `include` naming
 * a file outright — `['counter.ts']`, the single most obvious way to write it —
 * matched nothing at all.
 *
 * Sorted, so a build's output order does not depend on filesystem order.
 */
async function matchSources(sourceDir: string, include: string[], exclude: string[]): Promise<string[]> {
  const expand = async (patterns: string[]): Promise<Set<string>> => {
    const files = new Set<string>()

    for (const pattern of patterns) {
      for await (const file of new Bun.Glob(pattern).scan({ cwd: sourceDir, absolute: true, onlyFiles: true }))
        files.add(resolve(file))
    }

    return files
  }

  const included = await expand(include)
  const excluded = exclude.length ? await expand(exclude) : new Set<string>()

  return [...included].filter(file => !excluded.has(file)).sort()
}

/** The import specifier an entry point uses to reach one of its sources. */
export function entrySpecifier(entry: string, source: string): string {
  const path = relative(resolve(entry, '..'), source).replace(/\.ts$/, '')

  return path.startsWith('.') ? path : `./${path}`
}
