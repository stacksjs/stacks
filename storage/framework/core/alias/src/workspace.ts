import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

type ExportTarget = string | null | { [condition: string]: ExportTarget }
interface WorkspaceManifest {
  name: string
  exports?: Record<string, ExportTarget>
  main?: string
}
export interface WorkspacePackage {
  directory: string
  manifest: WorkspaceManifest
}

/** Discover actual package identities; a directory name is never an npm name. */
export function workspacePackages(core: string): Map<string, WorkspacePackage> {
  const found = new Map<string, WorkspacePackage>()
  for (const entry of readdirSync(core, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue
    const directory = join(core, entry.name), path = join(directory, 'package.json')
    if (!existsSync(path)) continue
    const manifest = JSON.parse(readFileSync(path, 'utf8')) as WorkspaceManifest
    if (!manifest.name) throw new Error(`Workspace manifest has no name: ${path}`)
    if (found.has(manifest.name)) throw new Error(`Duplicate workspace package name: ${manifest.name}`)
    found.set(manifest.name, { directory, manifest })
  }
  return found
}

function runtimeTarget(target: ExportTarget | undefined): string | null | undefined {
  if (typeof target === 'string') return target
  if (target === null || target === undefined) return target
  for (const [condition, value] of Object.entries(target)) {
    if (!['bun', 'node', 'import', 'default'].includes(condition)) continue
    const selected = runtimeTarget(value)
    if (selected !== undefined) return selected
  }
}

/** Match published dist entries to their authored source, without consulting dist. */
function sourceTarget(pkg: WorkspacePackage, target: string, core: string): string {
  if (!target.startsWith('./') || target.split('/').includes('..')) throw new Error(`Invalid workspace export: ${pkg.manifest.name} -> ${target}`)
  const base = pkg.manifest.name === '@stacksjs/defaults' && target !== './package.json' ? join(dirname(core), 'defaults') : pkg.directory
  const path = resolve(base, target.replace(/^\.\/dist\//, './src/'))
  if (path.includes('*')) {
    const prefix = path.slice(0, path.indexOf('*'))
    const directory = prefix.endsWith('/') ? prefix : dirname(prefix)
    if (!existsSync(directory) || !statSync(directory).isDirectory()) throw new Error(`Missing workspace wildcard source: ${pkg.manifest.name} -> ${target}`)
    return path.replace(/\.js$/, '.ts')
  }
  const stem = path.replace(/\.js$/, '')
  const source = [path.endsWith('.js') ? `${stem}.ts` : path, `${stem}.tsx`, path].find(candidate => existsSync(candidate) && statSync(candidate).isFile())
  if (!source) throw new Error(`Missing workspace export source: ${pkg.manifest.name} -> ${target}`)
  return source
}

/** Only manifest-declared package and umbrella entrypoints become source aliases. */
export function workspaceSourceAliases(core: string): Record<string, string> {
  const packages = workspacePackages(core), aliases: Record<string, string> = {}
  for (const [name, pkg] of packages) {
    const exports = pkg.manifest.exports ?? { '.': `./${(pkg.manifest.main ?? 'src/index.ts').replace(/^\.\//, '')}` }
    for (const [subpath, value] of Object.entries(exports)) {
      const target = runtimeTarget(value)
      if (!target) continue
      if (subpath !== '.' && !subpath.startsWith('./')) throw new Error(`Invalid workspace export key: ${name} ${subpath}`)
      aliases[name + (subpath === '.' ? '' : subpath.slice(1))] = sourceTarget(pkg, target, core)
    }
  }
  const umbrella = JSON.parse(readFileSync(join(core, 'package.json'), 'utf8')) as WorkspaceManifest
  for (const [subpath, value] of Object.entries(umbrella.exports ?? {})) {
    const target = runtimeTarget(value)
    if (!target) continue
    const match = /^\.\/dist\/([a-z][a-z-]*)\.js$/.exec(target)
    if (!match) throw new Error(`Unsupported umbrella export: ${subpath} -> ${target}`)
    const directory = join(core, match[1]!)
    const pkg = [...packages.values()].find(pkg => pkg.directory === directory)
    if (!pkg) throw new Error(`Umbrella export has no workspace package: ${subpath}`)
    const source = aliases[pkg.manifest.name]
    if (!source) throw new Error(`Umbrella export has no source entry: ${subpath}`)
    aliases[umbrella.name + (subpath === '.' ? '' : subpath.slice(1))] = source
  }
  return Object.fromEntries(Object.entries(aliases).sort(([a], [b]) => a.localeCompare(b)))
}

export function workspaceSourcePaths(core: string, configDirectory: string): Record<string, string[]> {
  return Object.fromEntries(Object.entries(workspaceSourceAliases(core)).map(([name, source]) => [name, [`./${relative(configDirectory, source).split('\\').join('/')}`]]))
}
