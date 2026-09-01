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
 * One honest limit: this resolves with `existsSync`, so on a case-insensitive
 * filesystem (macOS by default) `Actions/Auth/LogInAction` matches
 * `LoginAction.ts` and a case-only typo passes locally. It fails on CI, where
 * the filesystem is case-sensitive — which is the environment that matters,
 * since that is also where the route would 500 in production. Verified both
 * ways: a genuinely absent action is reported on either platform.
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

function resolvesToAnAction(reference: string): boolean {
  const relative = reference.replace(/^Actions\//, '')

  return ACTION_ROOTS.some(base =>
    ['.ts', '.js', '/index.ts'].some(suffix => existsSync(join(base, relative + suffix))),
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
