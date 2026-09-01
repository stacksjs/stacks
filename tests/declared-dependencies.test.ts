/**
 * Every published `@stacksjs/*` package must declare what its shipped dist
 * imports.
 *
 * A workspace hides this: inside a Stacks app the umbrella `stacks` package
 * pulls the whole framework in, so a package importing a sibling it never
 * declared resolves anyway. Installed on its own - which several of these
 * packages' READMEs invite - it throws `Cannot find module` on the first
 * import.
 *
 * Regression guard for stacksjs/stacks#2388, where `@stacksjs/payments`
 * published `dependencies: {}` while its dist imported `@stacksjs/config`,
 * `@stacksjs/orm` and `@stacksjs/logging`. The audit found the same shape in
 * 54 packages.
 */

import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { join } from 'node:path'

const coreDir = join(import.meta.dir, '../storage/framework/core')
const transpiler = new Bun.Transpiler({ loader: 'ts' })

function sourceFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir))
    return out

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'tests', 'test', '__tests__'].includes(entry.name))
        continue
      sourceFiles(path, out)
    }
    else if (/\.tsx?$/.test(entry.name) && !/\.(test|spec)\.ts$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(path)
    }
  }

  return out
}

/** The npm package a specifier resolves to, or null when it resolves to something we do not install. */
function packageOf(specifier: string): string | null {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('~'))
    return null
  if (specifier.startsWith('node:') || specifier.startsWith('bun:') || specifier === 'bun')
    return null

  const name = specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0]

  return isBuiltin(name) ? null : name
}

interface Pkg { name: string, dir: string, json: any }

const packages: Pkg[] = readdirSync(coreDir, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && existsSync(join(coreDir, entry.name, 'package.json')))
  .map((entry) => {
    const dir = join(coreDir, entry.name)
    // eslint-disable-next-line ts/no-require-imports
    const json = require(join(dir, 'package.json'))
    return { name: json.name, dir, json }
  })
  .filter(pkg => pkg.name && !pkg.json.private)

describe('published package dependencies', () => {
  it('finds the core packages', () => {
    expect(packages.length).toBeGreaterThan(50)
  })

  it('declares every package its source imports', async () => {
    const undeclared: string[] = []

    for (const pkg of packages) {
      const declared = new Set([
        ...Object.keys(pkg.json.dependencies ?? {}),
        ...Object.keys(pkg.json.peerDependencies ?? {}),
        ...Object.keys(pkg.json.optionalDependencies ?? {}),
      ])

      for (const file of sourceFiles(join(pkg.dir, 'src'))) {
        let imports

        try {
          imports = transpiler.scanImports(await Bun.file(file).text())
        }
        catch {
          continue // not our business to fail the dependency check on a syntax error
        }

        for (const imported of imports) {
          const name = packageOf(imported.path)
          if (!name || name === pkg.name || declared.has(name))
            continue

          const where = file.slice(pkg.dir.length + 1)
          undeclared.push(`${pkg.name} imports ${name} (${where}) but does not declare it`)
        }
      }
    }

    expect([...new Set(undeclared)].sort()).toEqual([])
  })

  it('does not declare the same package as both a dependency and a devDependency', () => {
    const doubled: string[] = []

    for (const pkg of packages) {
      const dev = Object.keys(pkg.json.devDependencies ?? {})

      for (const name of Object.keys(pkg.json.dependencies ?? {})) {
        if (dev.includes(name))
          doubled.push(`${pkg.name}: ${name} is both a dependency and a devDependency`)
      }
    }

    expect(doubled).toEqual([])
  })
})
