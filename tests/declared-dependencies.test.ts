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
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { isBuiltin } from 'node:module'
import { dirname, join, resolve, sep } from 'node:path'

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

  it('ships one STX release across compiler, runtime, desktop and sanitizer declarations', async () => {
    const root = await Bun.file(join(import.meta.dir, '../package.json')).json()
    const umbrella = await Bun.file(join(coreDir, 'package.json')).json()
    const expected = root.dependencies['@stacksjs/stx']
    expect(expected).toMatch(/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/)
    const runtimePackages = new Set(['@stacksjs/stx', '@stacksjs/components', 'bun-plugin-stx', '@stacksjs/desktop', '@stacksjs/sanitizer', 'stx-router'])
    const mismatched: string[] = []
    for (const manifest of [root, umbrella, ...packages.map(pkg => pkg.json)]) {
      for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
        for (const [name, version] of Object.entries(manifest[field] ?? {})) {
          if (runtimePackages.has(name) && version !== expected)
            mismatched.push(`${manifest.name}: ${field}.${name} is ${version}; expected ${expected}`)
        }
      }
    }
    expect(mismatched.sort()).toEqual([])
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

  it('includes every umbrella export in its published files', async () => {
    const manifest = await Bun.file(join(coreDir, 'package.json')).json()
    const missing: string[] = []
    const targets = Object.values(manifest.exports).flatMap(value => Object.values(value as Record<string, string>)) as string[]
    targets.push(manifest.types)
    for (const target of targets) {
      const relative = target.replace(/^\.\//, '')
      if (!manifest.files.some((file: string) => relative === file || relative.startsWith(`${file}/`)))
        missing.push(target)
    }
    expect([...new Set(missing)]).toEqual([])
    const scratch = mkdtempSync(join(tmpdir(), 'stacks-umbrella-contract-'))
    const run = (args: string[]) => {
      const child = Bun.spawnSync(args, { cwd: coreDir, stdout: 'pipe', stderr: 'pipe' })
      expect(child.exitCode, child.stderr.toString()).toBe(0)
      return child.stdout.toString()
    }
    try {
      run([process.execPath, 'run', 'build:exports'])
      const archive = join(scratch, 'stacks.tgz')
      run([process.execPath, 'pm', 'pack', '--filename', archive])
      const entries = run(['tar', '-tzf', archive]).trim().split('\n')
      for (const target of new Set(targets))
        expect(entries).toContain(`package/${target.replace(/^\.\//, '')}`)
      const development = await import(join(coreDir, manifest.exports['./development'].import))
      expect(Object.keys(development)).toEqual([])

    }
    finally { rmSync(scratch, { recursive: true, force: true }) }
  })

  it('fails umbrella generation without replacing a prior build when a dependency is missing', async () => {
    const scratch = mkdtempSync(join(tmpdir(), 'stacks-umbrella-invalid-'))
    try {
      mkdirSync(join(scratch, 'dist'))
      mkdirSync(join(scratch, 'arrays', 'src'), { recursive: true })
      await Bun.write(join(scratch, 'dist', 'prior.js'), 'export const prior = true\n')
      await Bun.write(join(scratch, 'build-exports.ts'), await Bun.file(join(coreDir, 'build-exports.ts')).text())
      await Bun.write(join(scratch, 'package.json'), JSON.stringify({
        exports: { './arrays': { types: './dist/arrays.d.ts', import: './dist/arrays.js' } },
        dependencies: {},
      }))
      await Bun.write(join(scratch, 'arrays', 'package.json'), JSON.stringify({ name: '@stacksjs/arrays' }))
      await Bun.write(join(scratch, 'arrays', 'src', 'index.ts'), 'export const array = []\n')
      const child = Bun.spawnSync([process.execPath, join(scratch, 'build-exports.ts')], {
        cwd: scratch, stdout: 'pipe', stderr: 'pipe',
      })
      expect(child.exitCode).not.toBe(0)
      expect(child.stderr.toString()).toContain('Umbrella export requires a declared dependency: @stacksjs/arrays')
      expect(await Bun.file(join(scratch, 'dist', 'prior.js')).text()).toBe('export const prior = true\n')
      expect(await Bun.file(join(scratch, 'dist', 'arrays.js')).exists()).toBe(false)
    }
    finally { rmSync(scratch, { recursive: true, force: true }) }
  })

  it('keeps CLI static runtime imports inside its published package boundary', async () => {
    const escaped: string[] = []
    const cli = packages.find(pkg => pkg.name === '@stacksjs/buddy')
    expect(cli).toBeDefined()
    for (const pkg of [cli!]) {
      for (const file of sourceFiles(join(pkg.dir, 'src'))) {
        const imports = transpiler.scanImports(await Bun.file(file).text())
        for (const imported of imports) {
          if (imported.kind !== 'import-statement' || !imported.path.startsWith('.'))
            continue
          const target = resolve(dirname(file), imported.path)
          if (target !== pkg.dir && !target.startsWith(`${pkg.dir}${sep}`))
            escaped.push(`${pkg.name}: ${file.slice(pkg.dir.length + 1)} imports ${imported.path}`)
        }
      }
    }
    expect(escaped.sort()).toEqual([])
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
