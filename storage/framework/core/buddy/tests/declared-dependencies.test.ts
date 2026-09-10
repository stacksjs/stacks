import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'bun:test'

/**
 * Every `@stacksjs/*` this package imports is one it depends on.
 *
 * `@stacksjs/buddy` shipped for a long time importing five packages it never
 * declared — `env`, `analytics`, `browser-extension`, `scheduler` and
 * `tinker` — and it worked, because buddy is nearly always run from inside a
 * scaffolded application whose own tree happens to contain them. Installed on
 * its own it did not run at all:
 *
 *     Cannot find module '@stacksjs/query-builder' from
 *     node_modules/@stacksjs/database/dist/index.js
 *
 * which is the same bug one package over. That is the failure mode this
 * guards: a dependency satisfied by the neighbourhood rather than by the
 * manifest is invisible until somebody installs the package alone.
 */

const packageRoot = dirname(import.meta.dir)

/**
 * Source with its comments removed, so prose ABOUT an import is not read as one.
 *
 * `snippets.ts` documents why a regex cannot follow `export * from
 * '@stacksjs/bun-router'`, and this scanner - being a regex - promptly read that
 * sentence as an import and demanded the package be declared. The irony is
 * enjoyable and the false positive is not: a comment is the one place a
 * specifier appears without being a dependency.
 *
 * Block comments first, then line comments, and only `//` that starts a line or
 * follows whitespace - so a `https://` inside a string survives.
 */
export function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/[^\n]*/g, '$1')
}

/** Every `@stacksjs/*` specifier under `src`, from static and dynamic imports. */
function importedScopedPackages(dir: string, found = new Set<string>()): Set<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)

    if (statSync(path).isDirectory()) {
      importedScopedPackages(path, found)
      continue
    }

    if (!path.endsWith('.ts'))
      continue

    const source = withoutComments(readFileSync(path, 'utf-8'))

    for (const match of source.matchAll(/from\s+['"](@stacksjs\/[a-z0-9-]+)['"]/g))
      found.add(match[1]!)

    for (const match of source.matchAll(/import\(['"](@stacksjs\/[a-z0-9-]+)['"]\)/g))
      found.add(match[1]!)
  }

  return found
}

describe('the manifest covers what the source imports', () => {
  it('declares every @stacksjs package buddy imports', () => {
    const manifest = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf-8'))
    const declared = new Set(Object.keys(manifest.dependencies ?? {}))

    /*
     * `@stacksjs/stx` is the one exemption, and it is a real one: it is
     * imported inside a try/catch in `production-server.ts` to pick up the
     * *application's* stx if it has one. Declaring it would make buddy carry a
     * renderer it only ever borrows.
     */
    const optional = new Set(['@stacksjs/stx'])

    const undeclared = [...importedScopedPackages(join(packageRoot, 'src'))]
      .filter(name => !declared.has(name) && !optional.has(name))
      .sort()

    expect(undeclared).toEqual([])
  })
})

describe('withoutComments', () => {
  it('drops a specifier that only appears in prose', () => {
    // The case that broke this: a docblock explaining a re-export.
    const source = "/**\n * `export * from '@stacksjs/bun-router'` is why.\n */\nexport const x = 1\n"
    expect(withoutComments(source)).not.toContain('@stacksjs/bun-router')
  })

  it('drops a line comment', () => {
    expect(withoutComments("// import { a } from '@stacksjs/cli'\nconst b = 1")).not.toContain('@stacksjs/cli')
  })

  it('keeps a real import', () => {
    const source = "import { log } from '@stacksjs/cli'\n"
    expect(withoutComments(source)).toContain('@stacksjs/cli')
  })

  it('keeps a URL inside a string, which is not a comment', () => {
    // `//` after a colon is part of a URL. Stripping it would truncate the
    // string and could take a real import on the same line with it.
    expect(withoutComments("const url = 'https://example.com/x'\n")).toContain('https://example.com/x')
  })

  it('keeps an import that follows a block comment on the same line', () => {
    expect(withoutComments("/* note */ import { a } from '@stacksjs/cli'")).toContain('@stacksjs/cli')
  })
})
