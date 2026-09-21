import { lstatSync } from 'node:fs'
import { isAbsolute, posix, relative, resolve, sep, win32 } from 'node:path'

export function isSafePortableRelativePath(path: unknown): path is string {
  return typeof path === 'string'
    && path.length > 0
    && !path.includes('\\')
    && !path.split('/').some(segment => segment === '..')
    && !posix.isAbsolute(path)
    && !win32.isAbsolute(path)
    && posix.normalize(path) === path
}

export function artifactRelativeFile(root: string, path: unknown, expected: string, kind: string): string {
  if (typeof path !== 'string' || path.length === 0)
    throw new Error(`${kind} path is missing`)
  if (!isSafePortableRelativePath(path))
    throw new Error(`${kind} path is not a safe artifact-relative path: ${path}`)
  if (path !== expected)
    throw new Error(`${kind} path is not deterministic: ${path}`)

  const file = resolve(root, path)
  const fromRoot = relative(root, file)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot))
    throw new Error(`${kind} path escapes its artifact root: ${path}`)
  return file
}

export function regularArtifactFileSize(file: string, kind: string): number {
  let stat
  try {
    stat = lstatSync(file)
  }
  catch {
    throw new Error(`${kind} file is missing: ${file}`)
  }
  if (!stat.isFile())
    throw new Error(`${kind} path is not a regular file: ${file}`)
  if (stat.size <= 0)
    throw new Error(`${kind} file is empty: ${file}`)
  return stat.size
}
