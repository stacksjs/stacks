/**
 * Library-section helpers — list framework components, functions, and
 * packages by scanning the filesystem rather than querying a model.
 * These pages document developer-facing surface area; they have no DB
 * counterpart.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

let projectRootCache: string | null = null
function projectRoot(): string {
  if (projectRootCache) return projectRootCache
  let dir = process.cwd()
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'storage/framework/defaults'))) {
      projectRootCache = dir
      return dir
    }
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  projectRootCache = process.cwd()
  return projectRootCache
}

export interface ComponentEntry {
  name: string
  path: string
  category: string
  size: number
}

/**
 * Scan the dashboard component directory plus any user component
 * directories. Returns one entry per `.stx` / `.vue` file with the file
 * size (so the UI can show "small", "medium", "large" hints).
 */
export function listComponents(): ComponentEntry[] {
  const root = projectRoot()
  const dirs = [
    { dir: 'storage/framework/defaults/resources/components/Dashboard', category: 'dashboard' },
    { dir: 'resources/components', category: 'app' },
  ]
  const out: ComponentEntry[] = []
  for (const { dir, category } of dirs) {
    const abs = resolve(root, dir)
    if (!existsSync(abs)) continue
    walkSync(abs, (file) => {
      if (!/\.(stx|vue|tsx|jsx)$/.test(file)) return
      try {
        const stat = statSync(file)
        out.push({
          name: file.split('/').pop()!.replace(/\.[^.]+$/, ''),
          path: file.slice(root.length + 1),
          category,
          size: stat.size,
        })
      }
      catch { /* skip unreadable files */ }
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export interface FunctionEntry {
  name: string
  path: string
  category: string
}

/**
 * Scan the resources/functions tree. Each `.ts` file is one logical
 * helper; the category is the immediate parent directory.
 */
export function listFunctions(): FunctionEntry[] {
  const root = projectRoot()
  const dirs = [
    'storage/framework/defaults/resources/functions',
    'resources/functions',
  ]
  const out: FunctionEntry[] = []
  for (const dir of dirs) {
    const abs = resolve(root, dir)
    if (!existsSync(abs)) continue
    walkSync(abs, (file) => {
      if (!file.endsWith('.ts')) return
      const rel = file.slice(abs.length + 1)
      const parts = rel.split('/')
      const category = parts.length > 1 ? parts[0] : 'core'
      out.push({
        name: parts[parts.length - 1].replace(/\.ts$/, ''),
        path: file.slice(root.length + 1),
        category,
      })
    })
  }
  return out.sort((a, b) => (a.category + a.name).localeCompare(b.category + b.name))
}

export interface PackageEntry {
  name: string
  version: string
  type: 'workspace' | 'dependency' | 'devDependency'
  description?: string
}

/**
 * Read the root package.json plus every workspace package.json. Workspace
 * packages get `type: 'workspace'`, runtime deps `'dependency'`, dev deps
 * `'devDependency'`. The list is what Library / Packages and Home /
 * Dependencies render.
 */
export function listPackages(): PackageEntry[] {
  const root = projectRoot()
  const out: PackageEntry[] = []

  // Root package.json deps
  const rootPkgPath = resolve(root, 'package.json')
  if (existsSync(rootPkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(rootPkgPath, 'utf8'))
      for (const [name, version] of Object.entries(pkg.dependencies || {})) {
        out.push({ name, version: String(version), type: 'dependency' })
      }
      for (const [name, version] of Object.entries(pkg.devDependencies || {})) {
        out.push({ name, version: String(version), type: 'devDependency' })
      }
    }
    catch { /* malformed root package.json */ }
  }

  // Workspace packages — scan storage/framework/core/ and storage/framework/<top>/
  const workspaceRoots = [
    'storage/framework/core',
    'storage/framework',
  ]
  const seen = new Set<string>()
  for (const wr of workspaceRoots) {
    const abs = resolve(root, wr)
    if (!existsSync(abs)) continue
    for (const entry of readdirSync(abs)) {
      const pkgFile = join(abs, entry, 'package.json')
      if (!existsSync(pkgFile)) continue
      if (seen.has(pkgFile)) continue
      seen.add(pkgFile)
      try {
        const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
        if (!pkg.name) continue
        out.push({
          name: pkg.name,
          version: pkg.version || '0.0.0',
          type: 'workspace',
          description: pkg.description,
        })
      }
      catch { /* skip malformed package.json */ }
    }
  }

  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export interface ActionEntry {
  name: string
  path: string
  category: string
}

/**
 * List user-defined actions plus framework default actions. Actions are
 * `.ts` files under `app/Actions/` (user) or `storage/framework/defaults/actions/`
 * (framework) — one file per action.
 */
export function listActions(): ActionEntry[] {
  const root = projectRoot()
  const dirs = [
    { dir: 'app/Actions', category: 'app' },
    { dir: 'storage/framework/defaults/actions', category: 'framework' },
  ]
  const out: ActionEntry[] = []
  for (const { dir, category } of dirs) {
    const abs = resolve(root, dir)
    if (!existsSync(abs)) continue
    walkSync(abs, (file) => {
      if (!file.endsWith('.ts')) return
      const rel = file.slice(abs.length + 1)
      out.push({
        name: rel.replace(/\.ts$/, '').replace(/\//g, '.'),
        path: file.slice(root.length + 1),
        category,
      })
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

export interface CommandEntry {
  name: string
  path: string
  category: string
}

/**
 * List user CLI commands (`app/Commands/`) plus framework `buddy`
 * subcommands (`storage/framework/core/buddy/src/commands/`).
 */
export function listCommands(): CommandEntry[] {
  const root = projectRoot()
  const dirs = [
    { dir: 'app/Commands', category: 'app' },
    { dir: 'storage/framework/core/buddy/src/commands', category: 'buddy' },
  ]
  const out: CommandEntry[] = []
  for (const { dir, category } of dirs) {
    const abs = resolve(root, dir)
    if (!existsSync(abs)) continue
    walkSync(abs, (file) => {
      if (!file.endsWith('.ts')) return
      const rel = file.slice(abs.length + 1)
      out.push({
        name: rel.replace(/\.ts$/, '').replace(/\//g, ' '),
        path: file.slice(root.length + 1),
        category,
      })
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Recursively walk a directory, calling `cb` once per file. Skips
 * `node_modules` and `dist` so we don't traverse compiled output.
 */
function walkSync(dir: string, cb: (file: string) => void): void {
  let entries: string[]
  try { entries = readdirSync(dir) }
  catch { return }
  for (const e of entries) {
    if (e === 'node_modules' || e === 'dist' || e === '.git' || e.startsWith('.')) continue
    const full = join(dir, e)
    let s
    try { s = statSync(full) }
    catch { continue }
    if (s.isDirectory()) walkSync(full, cb)
    else cb(full)
  }
}
