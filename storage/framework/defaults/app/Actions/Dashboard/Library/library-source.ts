import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { componentsPath, functionsPath } from '@stacksjs/path'

export interface FunctionSourceRow {
  name: string
  path: string
  extension: string
  bytes: number
  createdAt: string
  updatedAt: string
}

export interface WorkspacePackageRow {
  name: string
  version: string
  description: string
  license: string
  private: boolean
  path: string
  url: string
  dependencyCount: number
}

export interface ComponentSourceRow {
  name: string
  path: string
  category: string
  bytes: number
  updatedAt: string
}

function sourceFiles(root: string, extensions: string[]): string[] {
  if (!existsSync(root))
    return []

  const files: string[] = []
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(absolute)
        continue
      }

      if (entry.isFile() && extensions.includes(extname(entry.name)))
        files.push(absolute)
    }
  }

  visit(root)
  return files
}

export function functionSourceRows(projectRoot = process.cwd()): FunctionSourceRow[] {
  const root = projectRoot === process.cwd()
    ? functionsPath()
    : join(projectRoot, 'resources', 'functions')

  return sourceFiles(root, ['.ts', '.tsx', '.js', '.jsx'])
    .map((absolute) => {
      const stats = statSync(absolute)
      const path = relative(projectRoot, absolute).split(sep).join('/')
      const extension = extname(absolute)

      return {
        name: relative(root, absolute).split(sep).join('/').slice(0, -extension.length),
        path,
        extension: extension.slice(1),
        bytes: stats.size,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function componentSourceRows(projectRoot = process.cwd()): ComponentSourceRow[] {
  const root = projectRoot === process.cwd()
    ? componentsPath()
    : join(projectRoot, 'resources', 'components')

  return sourceFiles(root, ['.stx'])
    .map((absolute) => {
      const stats = statSync(absolute)
      const relativePath = relative(root, absolute).split(sep).join('/')
      const segments = relativePath.split('/')

      return {
        name: relativePath.slice(0, -extname(relativePath).length),
        path: relative(projectRoot, absolute).split(sep).join('/'),
        category: segments.length > 1 ? segments[0] || 'App' : 'App',
        bytes: stats.size,
        updatedAt: stats.mtime.toISOString(),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

function repositoryUrl(value: unknown): string {
  const raw = typeof value === 'string'
    ? value
    : value && typeof value === 'object' && 'url' in value
      ? String((value as { url?: unknown }).url || '')
      : ''

  return raw.replace(/^git\+/, '').replace(/\.git$/, '')
}

export function workspacePackageRows(projectRoot = process.cwd()): WorkspacePackageRow[] {
  const lockPath = join(projectRoot, 'bun.lock')
  if (!existsSync(lockPath))
    return []

  const lockfile = Bun.JSONC.parse(readFileSync(lockPath, 'utf8')) as {
    workspaces?: Record<string, unknown>
  }

  return Object.keys(lockfile.workspaces || {})
    .filter(Boolean)
    .map((workspacePath) => {
      const manifestPath = join(projectRoot, workspacePath, 'package.json')
      if (!existsSync(manifestPath))
        return null

      const manifest = Bun.JSONC.parse(readFileSync(manifestPath, 'utf8')) as {
        name?: string
        version?: string
        description?: string
        license?: string
        private?: boolean
        homepage?: string
        repository?: unknown
        dependencies?: Record<string, string>
        peerDependencies?: Record<string, string>
      }

      if (!manifest.name)
        return null

      return {
        name: manifest.name,
        version: manifest.version || '',
        description: manifest.description || '',
        license: manifest.license || '',
        private: Boolean(manifest.private),
        path: workspacePath,
        url: manifest.homepage || repositoryUrl(manifest.repository),
        dependencyCount: Object.keys({
          ...manifest.dependencies,
          ...manifest.peerDependencies,
        }).length,
      } satisfies WorkspacePackageRow
    })
    .filter((row): row is WorkspacePackageRow => Boolean(row))
    .sort((a, b) => a.name.localeCompare(b.name))
}
