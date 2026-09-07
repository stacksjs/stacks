import { relative, resolve } from 'node:path'
import process from 'node:process'

export function projectPath(filePath = '', options?: { relative: boolean }): string {
  let path = process.cwd()

  while (path.includes('storage')) {
    const parent = resolve(path, '..')
    if (parent === path) break
    path = parent
  }

  const finalPath = resolve(path, filePath)

  if (options?.relative)
    return relative(process.cwd(), finalPath)

  return finalPath
}

export function appPath(path?: string, options?: { relative?: boolean, cwd?: string }): string {
  const absolutePath = projectPath(`app/${path || ''}`)

  if (options?.relative)
    return relative(options.cwd || process.cwd(), absolutePath)

  return absolutePath
}

export function storagePath(path?: string): string {
  return projectPath(`storage/${path || ''}`)
}

export function frameworkPath(path?: string, options?: { relative?: boolean, cwd?: string }): string {
  const absolutePath = storagePath(`framework/${path || ''}`)

  if (options?.relative)
    return relative(options.cwd || process.cwd(), absolutePath)

  return absolutePath
}
