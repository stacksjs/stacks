/**
 * Whether an app has one copy of STX, for `buddy doctor`.
 *
 * STX is several packages released together at one version: the runtime, its
 * components, its compiler, the router, the desktop shell and the sanitizer.
 * Two versions of any of them in one app is two runtimes, and they do not
 * share what they register: pages rendered by one find no routes or
 * components in the other. It shows up as an empty route table, not as an
 * install error, and nothing in the install log says it happened.
 *
 * It happens when the app's STX packages are not all on one version: one of
 * them was raised and the others were not, or an override names a version
 * the dependencies do not.
 */
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
import { join } from 'node:path'

/** The STX packages, released together at one version. */
export const STX_PACKAGES: readonly string[] = ['@stacksjs/stx', '@stacksjs/components', 'bun-plugin-stx', 'stx-router', '@stacksjs/desktop', '@stacksjs/sanitizer']

/** The three an app declares; the rest follow the runtime. */
export const STX_DECLARED_PACKAGES: readonly string[] = ['@stacksjs/stx', '@stacksjs/components', 'bun-plugin-stx']

export interface StxCopy {
  name: string
  version: string
  /** Where it is installed, relative to the app. */
  path: string
}

function packagesIn(modules: string): Array<{ name: string, dir: string }> {
  let entries: string[]
  try {
    entries = readdirSync(modules)
  }
  catch {
    return []
  }
  const found: Array<{ name: string, dir: string }> = []
  for (const entry of entries) {
    if (entry === '.bin' || entry === '.cache')
      continue
    const dir = join(modules, entry)
    if (entry.startsWith('@')) {
      for (const scoped of packagesIn(dir))
        found.push({ name: `${entry}/${scoped.name}`, dir: scoped.dir })
    }
    else {
      found.push({ name: entry, dir })
    }
  }
  return found
}

/**
 * Every installed copy of an STX package under `root/node_modules`, nested
 * ones included, each real directory counted once.
 */
export function findStxCopies(root: string): StxCopy[] {
  const copies: StxCopy[] = []
  const seen = new Set<string>()

  const visit = (modules: string): void => {
    for (const { name, dir } of packagesIn(modules)) {
      let real: string
      try {
        real = realpathSync(dir)
      }
      catch {
        continue
      }
      if (seen.has(real))
        continue
      seen.add(real)

      // Bun's isolated store: `.bun/<name>@<version>/node_modules/<name>`.
      if (name === '.bun') {
        for (const stored of packagesIn(dir))
          visit(join(stored.dir, 'node_modules'))
        continue
      }

      if (STX_PACKAGES.includes(name)) {
        try {
          const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { name?: string, version?: string }
          if (manifest.name === name && typeof manifest.version === 'string')
            copies.push({ name, version: manifest.version, path: dir.slice(root.length + 1) })
        }
        catch {}
      }

      const nested = join(dir, 'node_modules')
      if (existsSync(nested))
        visit(nested)
    }
  }

  visit(join(root, 'node_modules'))
  return copies.sort((left, right) => left.name.localeCompare(right.name) || left.version.localeCompare(right.version, undefined, { numeric: true }))
}

export interface StxCopiesReport {
  status: 'pass' | 'fail'
  message: string
}

/**
 * What `buddy doctor` says about them. Null when STX is not installed at
 * all, which is not this check's to report.
 */
export function describeStxCopies(copies: StxCopy[]): StxCopiesReport | null {
  if (copies.length === 0)
    return null

  const versions = [...new Set(copies.map(copy => copy.version))].sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
  if (versions.length === 1)
    return { status: 'pass', message: `one copy, ${versions[0]}` }

  const split = STX_PACKAGES
    .map(name => ({ name, versions: [...new Set(copies.filter(copy => copy.name === name).map(copy => copy.version))] }))
    .filter(entry => entry.versions.length > 0)
    .map(entry => `${entry.name} ${entry.versions.join(' and ')}`)
  return {
    status: 'fail',
    message: `${versions.length} versions are installed (${split.join('; ')}). Two copies do not share routes or components, so pages can render with none. `
      + `Declare ${STX_DECLARED_PACKAGES.join(', ')} at one version in package.json, remove any override of them, and reinstall.`,
  }
}
