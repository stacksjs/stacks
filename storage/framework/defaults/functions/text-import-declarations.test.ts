import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

/**
 * A defaults module that imports a stylesheet (or any non-code file) as text
 * needs a `declare module` for that specifier, and an app has to SEE it. The
 * declaration used to sit beside the module unreferenced: this repo's tsconfig
 * happened to include it, an app's does not, so every app's `buddy typecheck`
 * failed on stacks 0.75.75 (`Cannot find module '@xterm/xterm/css/xterm.css'`).
 *
 * The rule this holds: such a module references its declaration with
 * `/// <reference path>`, so it reaches any program that typechecks the module.
 */

const defaultsRoot = resolve(import.meta.dir, '..')
const TEXT_IMPORT = /import\(\s*'([^']+)'\s*,\s*\{\s*with:\s*\{\s*type:\s*'text'\s*\}\s*\}\s*\)|from\s+'([^']+)'\s+with\s+\{\s*type:\s*'text'\s*\}/g
const REFERENCE = /^\/\/\/\s*<reference\s+path="([^"]+)"\s*\/>/gm

function textImports(source: string): string[] {
  return [...source.matchAll(TEXT_IMPORT)].map(match => (match[1] ?? match[2])!).filter(spec => !spec.startsWith('.'))
}

function declaredByReferences(file: string, source: string): string {
  return [...source.matchAll(REFERENCE)].map(match => readFileSync(join(dirname(file), match[1]!), 'utf8')).join('\n')
}

const modules = [...new Bun.Glob('**/*.ts').scanSync({ cwd: defaultsRoot, absolute: true })]
  .filter(file => !file.includes('/node_modules/') && !file.endsWith('.d.ts') && !file.endsWith('.test.ts'))
  .map(file => ({ file, source: readFileSync(file, 'utf8') }))
  .filter(({ source }) => textImports(source).length > 0)

describe('text imports in the defaults', () => {
  it('finds the ones there are', () => {
    // The scan is only worth something while it sees the case that broke.
    expect(modules.map(({ file }) => file.slice(defaultsRoot.length + 1))).toContain('functions/remote-terminal-element.ts')
  })

  it('reference a declaration for each specifier, so an app typechecking the module sees it', () => {
    const missing = modules.flatMap(({ file, source }) => {
      const declared = declaredByReferences(file, source)
      return textImports(source)
        .filter(spec => !declared.includes(`declare module '${spec}'`))
        .map(spec => `${file.slice(defaultsRoot.length + 1)}: ${spec}`)
    })
    expect(missing).toEqual([])
  })
})
