import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path'
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

function externalUrl(value: unknown): string {
  const raw = typeof value === 'string'
    ? value
    : value && typeof value === 'object' && 'url' in value
      ? String((value as { url?: unknown }).url || '')
      : ''

  const normalized = raw
    .trim()
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')

  if (!normalized)
    return ''

  try {
    const url = new URL(normalized)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''
  }
  catch {
    return ''
  }
}

function sourceError(source: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error)
  return new Error(`Could not read dashboard library source ${source}: ${detail}`)
}

export function workspacePackageRows(projectRoot = process.cwd()): WorkspacePackageRow[] {
  const lockPath = join(projectRoot, 'bun.lock')
  if (!existsSync(lockPath))
    throw new Error('Could not read dashboard library source bun.lock: file does not exist')

  let lockfile: { workspaces?: Record<string, unknown> }
  try {
    lockfile = Bun.JSONC.parse(readFileSync(lockPath, 'utf8')) as {
      workspaces?: Record<string, unknown>
    }
  }
  catch (error) {
    throw sourceError('bun.lock', error)
  }

  if (lockfile.workspaces !== undefined && (
    !lockfile.workspaces
    || typeof lockfile.workspaces !== 'object'
    || Array.isArray(lockfile.workspaces)
  )) {
    throw new TypeError('Could not read dashboard library source bun.lock: workspaces must be an object')
  }

  return Object.keys(lockfile.workspaces || {})
    .filter(Boolean)
    .map((workspacePath) => {
      const manifestPath = resolve(projectRoot, workspacePath, 'package.json')
      const manifestRelativePath = relative(projectRoot, manifestPath)
      if (
        manifestRelativePath === '..'
        || manifestRelativePath.startsWith(`..${sep}`)
        || isAbsolute(manifestRelativePath)
      ) {
        throw new Error(`Could not read dashboard library source ${workspacePath}: workspace escapes the project root`)
      }

      if (!existsSync(manifestPath))
        throw new Error(`Could not read dashboard library source ${workspacePath}/package.json: file does not exist`)

      let manifest: {
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
      try {
        manifest = Bun.JSONC.parse(readFileSync(manifestPath, 'utf8')) as typeof manifest
      }
      catch (error) {
        throw sourceError(`${workspacePath}/package.json`, error)
      }

      if (typeof manifest.name !== 'string' || !manifest.name.trim())
        throw new TypeError(`Could not read dashboard library source ${workspacePath}/package.json: package name is required`)

      return {
        name: manifest.name.trim(),
        version: manifest.version || '',
        description: manifest.description || '',
        license: manifest.license || '',
        private: Boolean(manifest.private),
        path: workspacePath,
        url: externalUrl(manifest.homepage) || externalUrl(manifest.repository),
        dependencyCount: Object.keys({
          ...manifest.dependencies,
          ...manifest.peerDependencies,
        }).length,
      } satisfies WorkspacePackageRow
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}
