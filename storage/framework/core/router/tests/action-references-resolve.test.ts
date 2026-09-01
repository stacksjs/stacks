/**
 * Every string action reference in a route file resolves to a real action.
 *
 * `route.post('/login', 'Actions/Auth/LoginAction')` names its handler with a
 * STRING, so a rename, a move or a typo is not a compile error and not a boot
 * error. It is a 500 the first time someone hits that path — which, for a
 * route nothing exercises in tests, can be a long way from the change that
 * broke it.
 *
 * There are ~650 of these across the default route files, resolved against
 * both `app/Actions` (the app's own, which override) and the framework
 * defaults. Nothing else checks them.
 *
 * Resolution is CASE-EXACT, against directory listings rather than
 * `existsSync`. On a case-insensitive filesystem — macOS by default —
 * `existsSync` says `Actions/Auth/LogInAction` exists because `LoginAction.ts`
 * does, so a case-only typo passes locally and 500s on Linux. Comparing
 * against what `readdirSync` actually returns gives the same answer on both,
 * which is the whole point of a guard like this: an author should not need the
 * right operating system to find out.
 */

import { describe, expect, it } from 'bun:test'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dir, '../../../../..')

function routeFiles(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir))
    return out

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist'].includes(entry.name))
        routeFiles(path, out)
    }
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
      out.push(path)
    }
  }

  return out
}

/**
 * Blank comments before scanning.
 *
 * The default dashboard routes document how to override a route with an
 * `@example` block naming `Actions/MyCustomLoginAction` — a deliberately
 * fictional action. Counting documentation as a reference makes this check
 * report a failure that is not one, which is the fastest way to get a test
 * muted.
 */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

const ACTION_ROOTS = [
  join(root, 'app/Actions'),
  join(root, 'storage/framework/defaults/app/Actions'),
]

/** Directory listings, memoised — one readdir per directory, not per lookup. */
const listings = new Map<string, Set<string>>()
function entriesOf(dir: string): Set<string> {
  let entries = listings.get(dir)
  if (!entries) {
    entries = existsSync(dir) ? new Set(readdirSync(dir)) : new Set()
    listings.set(dir, entries)
  }
  return entries
}

/** Does this exact path exist, matching case at every segment? */
function existsCaseExact(base: string, relativePath: string): boolean {
  let dir = base

  const segments = relativePath.split('/')
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index]!
    if (!entriesOf(dir).has(segment))
      return false
    dir = join(dir, segment)
  }

  return true
}

function resolvesToAnAction(reference: string): boolean {
  const relativePath = reference.replace(/^Actions\//, '')

  return ACTION_ROOTS.some(base =>
    ['.ts', '.js', '/index.ts'].some(suffix => existsCaseExact(base, relativePath + suffix)),
  )
}

const references: { file: string, action: string }[] = []

for (const file of [...routeFiles(join(root, 'storage/framework/defaults/routes')), ...routeFiles(join(root, 'routes'))]) {
  const source = withoutComments(readFileSync(file, 'utf8'))

  for (const match of source.matchAll(/route\.(?:get|post|put|patch|delete|any)\s*\(\s*[`'"][^`'"]+[`'"]\s*,\s*['"]([^'"]+)['"]/g)) {
    if (match[1].startsWith('Actions/'))
      references.push({ file: file.slice(root.length + 1), action: match[1] })
  }
}

describe('string action references in route files', () => {
  it('finds the references', () => {
    // A regex that silently stops matching would make this test pass forever.
    expect(references.length).toBeGreaterThan(100)
  })

  it('every one resolves to an action file', () => {
    const unresolved = references
      .filter(reference => !resolvesToAnAction(reference.action))
      .map(reference => `${reference.file} -> ${reference.action}`)

    expect([...new Set(unresolved)].sort()).toEqual([])
  })
})
