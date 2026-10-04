/**
 * The built extension, as VS Code will load it: dist/extension.js must parse
 * as CommonJS on Node and need nothing the .vsix does not ship (it is packaged
 * with `--no-dependencies`), and every asset the manifest names must exist.
 */
import { beforeAll, describe, expect, it } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
import process from 'node:process'

const root = join(import.meta.dir, '..')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

beforeAll(() => {
  const build = Bun.spawnSync([process.execPath, 'build.ts'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  if (build.exitCode !== 0)
    throw new Error(`build failed: ${build.stderr.toString()}`)
}, 120_000)

describe('dist/extension.js', () => {
  it('parses as CommonJS, the way VS Code\'s Node host loads it', () => {
    const bundle = readFileSync(join(root, 'dist/extension.js'), 'utf8')
    // An `import.meta` or a module-scope `await` anywhere in the file is a
    // syntax error inside Node's CommonJS wrapper, and Node then refuses the
    // whole extension.
    // eslint-disable-next-line no-new-func
    expect(() => new Function('exports', 'require', 'module', '__filename', '__dirname', bundle)).not.toThrow()
  })

  it('requires only vscode and Node built-ins', () => {
    const bundle = readFileSync(join(root, 'dist/extension.js'), 'utf8')
    const specifiers = new Set([...bundle.matchAll(/\b(?:require|import)\("([^"]+)"\)/g)].map(match => match[1]!))
    const builtins = new Set(builtinModules)
    // bunfig is only reached when the stx utility-class engine loads a config
    // file, which the extension never asks it to.
    const unshipped = [...specifiers].filter(specifier =>
      specifier !== 'vscode' && specifier !== 'bunfig' && !specifier.startsWith('node:') && !builtins.has(specifier))

    expect(unshipped).toEqual([])
  })
})

describe('dist/', () => {
  it('has every asset the manifest points at', () => {
    const paths = [
      manifest.main,
      ...manifest.contributes.languages.map((language: { configuration: string }) => language.configuration),
      ...manifest.contributes.grammars.map((grammar: { path: string }) => grammar.path),
      './dist/pickier-worker.js',
      './dist/pickier-worker.bunfig.toml',
      './dist/stx/snippets/stx.json',
    ]

    for (const path of paths)
      expect(existsSync(join(root, path))).toBeTrue()
  })
})
