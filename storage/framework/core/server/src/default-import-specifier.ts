import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/** Framework source imports its editable tree; applications import the defaults package contract. */
export function isFrameworkSourceCheckout(projectRoot: string): boolean {
  try {
    return JSON.parse(readFileSync(resolve(projectRoot, 'package.json'), 'utf8')).name === 'stacks'
      && existsSync(resolve(projectRoot, 'storage/framework/core/package.json'))
  }
  catch { return false }
}

/** Package-qualified defaults remain identical across npm, Pantry and relocated application roots. */
export function defaultImportSpecifier(file: string, roots: readonly string[], sourceCheckout = false): string | undefined {
  if (sourceCheckout) return undefined
  for (const root of roots) {
    const subpath = relative(resolve(root), resolve(file))
    if (!subpath || subpath === '..' || subpath.startsWith(`..${sep}`) || isAbsolute(subpath)) continue
    return `@stacksjs/defaults/${subpath.replace(/\\/g, '/')}`
  }
  return undefined
}
