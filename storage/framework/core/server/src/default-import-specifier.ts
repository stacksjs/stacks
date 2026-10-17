import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, relative, resolve, sep } from 'node:path'

/** Source checkouts and named --with-core apps import their editable defaults tree. */
export function isFrameworkSourceCheckout(projectRoot: string): boolean {
  try {
    const core = resolve(projectRoot, 'storage/framework/core')
    return JSON.parse(readFileSync(resolve(core, 'package.json'), 'utf8')).name === 'stacks'
      && existsSync(resolve(core, 'defaults/package.json'))
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
