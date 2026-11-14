import type { LibraryHostedOptions } from '@stacksjs/types/library'
import type { ResolvedLibraryPackage } from './packages'
import { createHash } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, relative, resolve, sep } from 'node:path'
import { gzipSync } from 'node:zlib'
import { projectPath } from '@stacksjs/path'
import { LibraryConfigError } from './packages'

export interface LibraryHostedFile {
  /** Public URL in a manifest, absolute filesystem path in a build report. */
  path: string
  bytes: number
  gzipBytes: number
  sha256: string
  integrity: string
}

export interface LibraryHostedManifest {
  schemaVersion: 1
  name: string
  /** The package version, including a package-specific pin. */
  version: string
  revision: string
  entrypoint: string
  immutableEntrypoint: string
  /** Content files only. Manifests cannot contain their own digest. */
  files: LibraryHostedFile[]
  csp: { styleSrc: string[] }
}

export interface LibraryHostedBuildReport {
  revision: string
  outputDir: string
  immutableDir: string
  manifestPath: string
  entryPath: string
  manifest: LibraryHostedManifest
  /** Includes both manifest copies and stable aliases for retention and verification. */
  files: Array<LibraryHostedFile & { relativePath: string, immutable: boolean, packagePath?: string }>
}

export interface LibraryHostedInput {
  pkg: ResolvedLibraryPackage
  config: LibraryHostedOptions
  outputDir: string
  entryPath: string
  loader?: { bytes: Uint8Array, exports: string[] }
  styles: string[]
}

function fail(pkg: { name: string }, message: string): never {
  throw new LibraryConfigError(`Package "${pkg.name}": ${message}`)
}

function plainPath(pkg: { name: string }, value: string, label: string): string {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || /[\s?#%]/.test(value) || value.split('/').some(part => !part || part === '.' || part === '..') || value.includes(':'))
    fail(pkg, `${label} must be a plain project-relative path.`)
  return projectPath(value)
}

function assertInsideProject(pkg: { name: string }, path: string): string {
  let existing = path
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing)
  const canonical = realpathSync(existing)
  const root = realpathSync(projectPath())
  if (canonical !== root && !canonical.startsWith(`${root}${sep}`))
    fail(pkg, `hosted path escapes the project through a symbolic link: ${path}`)
  return resolve(canonical, relative(existing, path))
}

function publicPath(pkg: { name: string }, value: string, label: string): string {
  const path = plainPath(pkg, value, label)
  if (!value.startsWith('public/')) fail(pkg, `${label} must be beneath public/.`)
  if (value.split('/').some(part => part.startsWith('.')))
    fail(pkg, `${label} cannot contain hidden path segments because default CI artifact retention excludes them.`)
  assertInsideProject(pkg, path)
  return path
}

function publicBase(pkg: { name: string }, value: string): string {
  if (typeof value !== 'string' || !value || /[\\\s?#%]/.test(value)) fail(pkg, 'hosted.base must be an absolute public path or HTTPS URL without a query or fragment.')
  const path = value.startsWith('https://') ? value.replace(/^https:\/\/[^/]+/, '') || '/' : value
  if (!path.startsWith('/') || path.split('/').some(part => part === '.' || part === '..') || (!value.startsWith('https://') && value.startsWith('//')))
    fail(pkg, 'hosted.base must be an absolute public path or HTTPS URL without traversal.')
  if (value.startsWith('https://')) {
    const url = new URL(value)
    if (url.username || url.password) fail(pkg, 'hosted.base cannot contain credentials.')
  }
  return value.replace(/\/$/, '')
}

function digest(bytes: Uint8Array | string, algorithm: string, encoding: 'hex' | 'base64'): string {
  return createHash(algorithm).update(bytes).digest(encoding)
}

function describe(path: string, bytes: Uint8Array): LibraryHostedFile {
  return { path, bytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength, sha256: digest(bytes, 'sha256', 'hex'), integrity: `sha384-${digest(bytes, 'sha384', 'base64')}` }
}

/** Share the browser source policy with the native configured-asset copy. */
export function assertHostedSourcePath(pkg: ResolvedLibraryPackage, path: string): void {
  const canonical = existsSync(path) ? realpathSync(path) : path
  const file = relative(projectPath(), canonical).replaceAll('\\', '/')
  if (/^(?:app|config|routes|database|storage\/framework\/(?:server|defaults\/app))\//.test(file) || /(?:^|\/)\.env(?:[./]|$)/.test(file))
    fail(pkg, `server source "${file}" cannot enter a hosted browser artifact.`)
}

/** Restrict browser artifacts before the normal runtime-export validator imports modules. */
function browserBoundary(pkg: ResolvedLibraryPackage): Bun.BunPlugin {
  return {
    name: 'stacks-library-browser-boundary',
    setup(build) {
      build.onResolve({ filter: /^(?:node:|bun(?:$|:)|@stacksjs\/(?:config|env|database|orm|server|auth|cloud|queue|email|secrets|actions)(?:\/|$))/ }, args => fail(pkg, `privileged import "${args.path}" cannot enter a hosted browser artifact.`))
      build.onLoad({ filter: /.*/ }, async (args) => {
        const path = realpathSync(args.path)
        const file = relative(projectPath(), path).replaceAll('\\', '/')
        assertHostedSourcePath(pkg, path)
        if (!/\.[cm]?[jt]sx?$/.test(path)) return
        const contents = await Bun.file(path).text()
        // Environment values are build-machine state, never a browser-library input.
        const { readsEnvironment } = await import('./browser-syntax')
        if (readsEnvironment(contents, path))
          fail(pkg, `environment access in "${file}" cannot enter a hosted browser artifact. Use explicit public define mappings.`)
        return { contents, loader: path.endsWith('.tsx') ? 'tsx' : path.endsWith('.jsx') ? 'jsx' : /\.[cm]?ts$/.test(path) ? 'ts' : 'js' }
      })
    },
  }
}

async function browserBuild(pkg: ResolvedLibraryPackage, source: string, define: Record<string, string> = {}): Promise<Uint8Array> {
  let result: Awaited<ReturnType<typeof Bun.build>>
  try {
    result = await Bun.build({ entrypoints: [source], target: 'browser', format: 'esm', minify: true, define, plugins: [browserBoundary(pkg)] })
  }
  catch (error) {
    fail(pkg, `hosted browser compilation failed: ${error instanceof AggregateError ? error.errors.join('\n') : String(error)}`)
  }
  if (!result.success || result.outputs.length !== 1 || !result.outputs[0])
    fail(pkg, `hosted browser compilation failed: ${result.logs.join('\n')}`)
  return new Uint8Array(await result.outputs[0].arrayBuffer())
}

async function loaderInput(pkg: ResolvedLibraryPackage, loader: NonNullable<LibraryHostedOptions['loader']>): Promise<LibraryHostedInput['loader']> {
  const source = plainPath(pkg, loader.source, 'hosted.loader.source')
  assertInsideProject(pkg, source)
  if (!await Bun.file(source).exists()) fail(pkg, `hosted loader source does not exist: ${loader.source}`)
  const bytes = await browserBuild(pkg, source, loader.define)
  const available = new Bun.Transpiler({ loader: 'js' }).scan(new TextDecoder().decode(bytes)).exports
  const exports = loader.exports ?? available
  if (!exports.length) fail(pkg, 'hosted loader must export at least one value.')
  for (const name of exports) {
    if (!/^(?:default|[A-Za-z_$][\w$]*)$/.test(name) || !available.includes(name))
      fail(pkg, `hosted loader has no export "${name}".`)
  }
  for (const [key, value] of Object.entries(loader.define ?? {})) {
    if (!/^[A-Za-z_$][\w$]*$/.test(key) || typeof value !== 'string')
      fail(pkg, 'hosted loader defines must map identifiers to explicit build expressions.')
  }
  return { bytes, exports: [...new Set(exports)] }
}

/** Pure config/path validation before writes; generated inputs need not exist yet. */
export async function prepareHostedInputs(packages: ResolvedLibraryPackage[]): Promise<Map<string, LibraryHostedInput>> {
  const inputs = new Map<string, LibraryHostedInput>()
  const owners: Array<{ path: string, name: string }> = []
  const publicBases = new Map<string, string>()
  for (const pkg of packages) {
    if (!pkg.hosted) continue
    if (pkg.kind !== 'web-components') fail(pkg, 'hosted output is only supported for web-components packages.')
    const config = { ...pkg.hosted, base: publicBase(pkg, pkg.hosted.base) }
    const outputDir = publicPath(pkg, config.outputDir, 'hosted.outputDir')
    const entryPath = publicPath(pkg, config.entry, 'hosted.entry')
    if (entryPath === outputDir || (entryPath.startsWith(`${outputDir}${sep}`) && dirname(entryPath) !== outputDir))
      fail(pkg, 'hosted.entry must be outside outputDir or directly beneath it, away from immutable revision directories.')
    if (extname(entryPath) !== '.js') fail(pkg, 'hosted.entry must end in .js.')
    if (basename(entryPath) === 'bundle.js' && config.loader) fail(pkg, 'hosted loader entry collides with the native bundle.js.')
    for (const asset of pkg.assets) {
      plainPath(pkg, asset.dest, 'hosted asset destination')
      if (asset.dest.split('/').some(part => part.startsWith('.'))) fail(pkg, 'hosted assets cannot contain hidden path segments.')
      const reserved = ['manifest.json', 'bundle.js', 'bundle.css', 'custom-elements.json', ...(config.loader ? [basename(entryPath)] : [])]
      if (reserved.some(name => asset.dest === name || asset.dest.startsWith(`${name}/`))) fail(pkg, `hosted asset ${asset.dest} collides with a native hosted output.`)
      assertHostedSourcePath(pkg, assertInsideProject(pkg, projectPath(asset.source)))
    }
    const canonicalPaths = [outputDir, entryPath].map(path => assertInsideProject(pkg, path))
    for (const owner of owners) {
      if (canonicalPaths.some(path => path === owner.path || path.startsWith(`${owner.path}${sep}`) || owner.path.startsWith(`${path}${sep}`)))
        fail(pkg, `hosted output collides with package "${owner.name}".`)
    }
    const baseOwner = publicBases.get(config.base)
    if (baseOwner) fail(pkg, `hosted public base collides with package "${baseOwner}".`)
    publicBases.set(config.base, pkg.name)
    owners.push(...canonicalPaths.map(path => ({ path, name: pkg.name })))
    for (const source of config.styles ?? []) {
      const path = plainPath(pkg, source, 'hosted.styles source')
      assertInsideProject(pkg, path)
      if (extname(path) !== '.css') fail(pkg, `hosted stylesheet must name a literal .css file: ${source}`)
    }
    if (config.loader) {
      assertInsideProject(pkg, plainPath(pkg, config.loader.source, 'hosted.loader.source'))
      for (const [key, value] of Object.entries(config.loader.define ?? {})) {
        if (!/^[A-Za-z_$][\w$]*$/.test(key) || typeof value !== 'string') fail(pkg, 'hosted loader defines must map identifiers to explicit build expressions.')
      }
    }
    inputs.set(pkg.name, { pkg, config, outputDir, entryPath, styles: [] })
  }
  return inputs
}

/** Read/compile only after the package's one native prebuild, rechecking paths. */
export async function materializeHostedInput(input: LibraryHostedInput): Promise<LibraryHostedInput> {
  const { pkg, config } = input
  publicPath(pkg, config.outputDir, 'hosted.outputDir')
  publicPath(pkg, config.entry, 'hosted.entry')
  const styles: string[] = []
  for (const source of config.styles ?? []) {
    const path = plainPath(pkg, source, 'hosted.styles source')
    assertInsideProject(pkg, path)
    if (!await Bun.file(path).exists()) fail(pkg, `hosted stylesheet must name an existing literal .css file: ${source}`)
    styles.push(await Bun.file(path).text())
  }
  return { ...input, styles, loader: config.loader ? await loaderInput(pkg, config.loader) : undefined }
}

/** Validate the compiler's full browser graph before retaining or publishing bytes. */
export async function validateHostedBrowser(input: LibraryHostedInput): Promise<void> {
  await browserBuild(input.pkg, resolve(input.pkg.dir, 'dist/index.js'))
}

async function immutableWrite(pkg: ResolvedLibraryPackage, path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  try {
    // wx makes concurrent writers fail closed rather than replacing retained bytes.
    await writeFile(path, bytes, { flag: 'wx' })
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    if (!Buffer.from(await readFile(path)).equals(Buffer.from(bytes))) fail(pkg, `Immutable hosted artifact changed at ${path}.`)
  }
}

async function stableWrite(path: string, bytes: Uint8Array): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${crypto.randomUUID()}.tmp`
  try { await writeFile(temporary, bytes, { flag: 'wx' }); await rename(temporary, path) }
  finally { await unlink(temporary).catch(() => {}) }
}

/** Retain one immutable revision, then move stable aliases to it. */
export async function buildHostedOutput(input: LibraryHostedInput, version: string, componentStyles: readonly string[], packageAssets: readonly { path: string, packagePath: string }[] = []): Promise<LibraryHostedBuildReport> {
  const { pkg, config, outputDir, entryPath, loader } = input
  if (!/^[a-zA-Z0-9.+-]+$/.test(version) || version.startsWith('.')) fail(pkg, 'package version cannot be used in a hosted revision path.')
  const assets = new Map<string, Uint8Array>()
  const packagePaths = new Map<string, string>()
  for (const file of ['bundle.js', 'custom-elements.json']) assets.set(file, await Bun.file(resolve(pkg.dir, 'dist', file)).bytes())
  if (await Bun.file(resolve(pkg.dir, 'dist/bundle.css')).exists()) assets.set('bundle.css', await Bun.file(resolve(pkg.dir, 'dist/bundle.css')).bytes())
  for (const name of assets.keys()) packagePaths.set(name, `dist/${name}`)
  const entryName = loader ? basename(entryPath) : 'bundle.js'
  if (loader) assets.set(entryName, loader.bytes)
  for (const asset of packageAssets) {
    const name = relative(resolve(pkg.dir, 'dist'), asset.path).replaceAll('\\', '/')
    plainPath(pkg, name, 'hosted asset destination')
    if (name.split('/').some(part => part.startsWith('.'))) fail(pkg, 'hosted assets cannot contain hidden path segments.')
    assertInsideProject(pkg, asset.path)
    if (/\.[cm]?[jt]sx?$/.test(name)) await browserBuild(pkg, asset.path)
    if (name === 'manifest.json' || [...assets.keys()].some(existing => name === existing || name.startsWith(`${existing}/`) || existing.startsWith(`${name}/`)))
      fail(pkg, `hosted asset ${name} collides with a native hosted output.`)
    assets.set(name, await Bun.file(asset.path).bytes())
    packagePaths.set(name, asset.packagePath)
  }
  const styles = [...componentStyles, ...input.styles]
  const csp = { styleSrc: [...new Set(styles.map(style => `'sha256-${digest(style, 'sha256', 'base64')}'`))].sort() }
  const identity = JSON.stringify({ schemaVersion: 1, name: pkg.name, version, csp, base: config.base, entry: config.entry, exports: loader?.exports, assets: [...assets].map(([name, bytes]) => [name, digest(bytes, 'sha256', 'hex')]) })
  const revision = `${version}-${digest(identity, 'sha256', 'hex').slice(0, 32)}`
  const immutableDir = resolve(outputDir, revision)
  assertInsideProject(pkg, immutableDir)
  const immutableEntrypoint = `${config.base}/${revision}/${entryName}`
  const origin = config.base.startsWith('https://') ? new URL(config.base).origin : ''
  const entrypoint = `${origin}/${relative(projectPath('public'), entryPath).replaceAll('\\', '/')}`
  const forwarded = loader?.exports ?? ['*']
  const stable = new TextEncoder().encode(forwarded.map(name => name === '*' ? `export * from ${JSON.stringify(immutableEntrypoint)};` : `export { ${name} } from ${JSON.stringify(immutableEntrypoint)};`).join('\n') + '\n')
  const manifest: LibraryHostedManifest = { schemaVersion: 1, name: pkg.name, version, revision, entrypoint, immutableEntrypoint, files: [...assets].map(([name, bytes]) => describe(`${config.base}/${revision}/${name}`, bytes)).concat(describe(entrypoint, stable)), csp }
  const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`)
  const report: LibraryHostedBuildReport = { revision, outputDir, immutableDir, manifestPath: resolve(immutableDir, 'manifest.json'), entryPath, manifest, files: [] }
  const retain = async (path: string, bytes: Uint8Array, immutable: boolean, packagePath?: string) => {
    assertInsideProject(pkg, path)
    if (immutable) await immutableWrite(pkg, path, bytes)
    else await stableWrite(path, bytes)
    report.files.push({ ...describe(path, bytes), relativePath: relative(projectPath(), path).replaceAll('\\', '/'), immutable, ...(packagePath ? { packagePath } : {}) })
  }
  for (const [name, bytes] of assets) await retain(resolve(immutableDir, name), bytes, true, packagePaths.get(name))
  await retain(report.manifestPath, manifestBytes, true)
  await retain(resolve(outputDir, 'manifest.json'), manifestBytes, false)
  await retain(entryPath, stable, false)
  return report
}
