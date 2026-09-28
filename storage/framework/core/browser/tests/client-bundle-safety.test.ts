// What the framework's own browser-side code can rely on once stx bundles it.
//
// `/register` and `/forgot-password` logged "useStorage is not defined", then
// "module ... is not registered on this page (#1957)", in apps on 0.75.13.
// `functions/auth.ts` DOES import `useStorage` - from
// `@stacksjs/browser/composables/useStorage`, a module that only re-exports
// `@stacksjs/composables/useStorage`. `@stacksjs/browser` declared
// `"sideEffects": false`, and Bun 1.3's bundler, building the page's module
// registry through stx's loader plugin, dropped that re-export-only module and
// left the call pointing at nothing. Reproduced against an app's installed
// packages on Bun 1.3.14; deleting the flag from the manifest is the whole fix.
// The repository's own Bun does not trip it, so the rule is pinned here rather
// than a bundle.
//
// The second half guards the names AGENTS.md lists as NOT provided in the
// browser: each is in the typing manifest and absent from the runtime, so a
// bare call type-checks and then throws during setup, taking the page down.

import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const FRAMEWORK = join(import.meta.dir, '../../..')
const CORE = join(FRAMEWORK, 'core')
const DEFAULTS = join(FRAMEWORK, 'defaults')

function walk(dir: string, accept: (file: string) => boolean): string[] {
  if (!existsSync(dir))
    return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist')
      continue
    const path = join(dir, entry)
    if (statSync(path).isDirectory())
      out.push(...walk(path, accept))
    else if (accept(path))
      out.push(path)
  }
  return out
}

/**
 * The framework's browser-side source: `<script client>` (and bare `<script>`)
 * blocks in its `.stx` files, and the `functions/` modules those scripts import.
 */
function browserSources(): Array<{ file: string, code: string }> {
  const sources: Array<{ file: string, code: string }> = []

  for (const file of walk(join(DEFAULTS, 'functions'), f => f.endsWith('.ts') && !f.endsWith('.test.ts') && !f.endsWith('.d.ts')))
    sources.push({ file: relative(DEFAULTS, file), code: readFileSync(file, 'utf8') })

  for (const dir of ['resources', 'views']) {
    for (const file of walk(join(DEFAULTS, dir), f => f.endsWith('.stx'))) {
      for (const match of readFileSync(file, 'utf8').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
        if (/\bserver\b/.test(match[1]!))
          continue
        sources.push({ file: relative(DEFAULTS, file), code: match[2]! })
      }
    }
  }

  return sources
}

/** Code with comments and string contents blanked, so prose cannot match. */
function codeOnly(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, '\'\'')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

describe('packages bundled into the framework\'s browser code', () => {
  /** A module whose whole body re-exports another package. */
  const reExportsAnotherPackage = (source: string): boolean => {
    const statements = codeOnly(source).split(/;|\n/).map(line => line.trim()).filter(Boolean)
    return statements.length > 0
      && statements.every(statement => /^export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+''$/.test(statement))
      && /from\s+['"](?!\.)/.test(source)
  }

  it('do not declare sideEffects: false while re-exporting another package', () => {
    const imported = new Set<string>()
    for (const { code } of browserSources()) {
      for (const match of code.matchAll(/^\s*import\s+(?!type\b)[^'"]*?from\s+['"]@stacksjs\/([\w-]+)/gm))
        imported.add(match[1]!)
    }
    // Sanity: the scan found the package this test is about.
    expect(imported.has('browser')).toBe(true)

    const offenders: string[] = []
    for (const name of imported) {
      const manifestPath = join(CORE, name, 'package.json')
      if (!existsSync(manifestPath))
        continue
      if (JSON.parse(readFileSync(manifestPath, 'utf8')).sideEffects !== false)
        continue

      const reExporters = walk(join(CORE, name, 'src'), f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
        .filter(file => reExportsAnotherPackage(readFileSync(file, 'utf8')))
      if (reExporters.length > 0)
        offenders.push(`@stacksjs/${name} (${relative(CORE, reExporters[0]!)})`)
    }

    expect(offenders).toEqual([])
  })
})

describe('names the browser runtime does not provide', () => {
  // AGENTS.md, "Auto-imports": in the manifest and absent from the runtime, or
  // in neither. Import them explicitly.
  const NOT_PROVIDED = [
    'debounce', 'throttle', 'clamp', 'delay', 'dateFormat', 'format',
    'loadCardElement', 'confirmPayment', 'confirmCardPayment',
    'useStorage', 'useNow', 'useDateFormat', 'useForm', 'useAbs',
    'useIntersectionObserver', 'useScroll', 'useMouse', 'useParallax', 'usePreferredReducedMotion',
  ]

  it('are never called bare in the framework\'s browser-side code', () => {
    const bare: string[] = []
    for (const { file, code } of browserSources()) {
      const body = codeOnly(code)
      const names = new Set([...NOT_PROVIDED, ...(body.match(/\buse[A-Z]\w*Store\b/g) ?? [])])
      for (const name of names) {
        if (!new RegExp(`(?<![.\\w$])${name}\\s*\\(`).test(body))
          continue
        const imported = new RegExp(`import\\s[^;]*\\b${name}\\b[^;]*from`).test(code)
        const declared = new RegExp(`(?:function\\s*\\*?\\s*|(?:const|let|var|class)\\s+)${name}\\b`).test(body)
          || new RegExp(`(?:const|let|var)\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(body)
        if (!imported && !declared)
          bare.push(`${file}: ${name}`)
      }
    }

    expect(bare).toEqual([])
  })
})
