/**
 * A raw query-builder row must never be *asserted* into a `ModelRow` type.
 *
 * `ModelRow<typeof X>` is `DeclaredAttributes & SnakeCaseAttributes`: it types
 * BOTH `currentBalance` and `current_balance` as present. The ORM delivers that
 * through the accessor proxy on a model row - but this package queries the RAW
 * builder, and there is no ORM query in it at all, so a row carries exactly the
 * column names the database has.
 *
 * A cast therefore claims properties that are `undefined` at runtime, and being
 * a cast, it silences the very mismatch it creates. `checkBalance()` read three
 * of them and reported every gift card invalid, because `!undefined` is `true`
 * (stacksjs/stacks#2417):
 *
 *   db row  : is_active true, current_balance 1, status ACTIVE
 *   fetched : isActive=undefined currentBalance=undefined
 *   result  : {"valid":false,...}
 *
 * `asModelRow` / `asModelRows` build the shape instead of asserting it. This
 * test exists because the failure is invisible: nothing goes red, a value is
 * just quietly missing, and the accurate schema that would catch the plain
 * casts cannot see through a cast via `unknown` at all.
 */
import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const SRC = resolve(import.meta.dir, '..')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory())
      return entry === 'tests' ? [] : sourceFiles(path)
    return path.endsWith('.ts') ? [path] : []
  })
}

const files = sourceFiles(SRC).map(path => ({
  path: relative(SRC, path),
  source: readFileSync(path, 'utf8'),
}))

/** Lines that are wholly comment, so prose about the rule cannot break it. */
function withoutComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n')
}

describe('raw rows are built into their model type, not cast to it', () => {
  it('never asserts a query result into a *JsonResponse type', () => {
    /*
     * Scoped to the case that is actually wrong: a value coming straight off
     * the query builder. Three shapes keep an `as` and are not this bug:
     *
     * - `} as unknown as X` closes an object LITERAL that adds relation keys
     *   (`{ ...model, category }`), so it is widening a value already built
     *   from a converted row, not asserting over a raw one.
     * - `x as X` where `x` came from a fetch in this package is narrowing away
     *   `| undefined`, and that fetch already returns the built shape.
     * - `coupons/fetch.ts` normalizes every key to its declared spelling and
     *   says so; its rows are not raw by the time they are typed.
     */
    const offenders: string[] = []

    for (const { path, source } of files) {
      for (const line of withoutComments(source).split('\n')) {
        if (!/\bas\s+\w+JsonResponse\b/.test(line))
          continue
        if (/\b(?:execute|executeTakeFirst)\(\)\s+as\s+\w+JsonResponse\b/.test(line))
          offenders.push(`${path}: ${line.trim()}`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('never routes a row through the blind asRow/asRows helpers', () => {
    // `asRow<T>(row)` is `row as unknown as T`. It asserts a shape without
    // checking or producing one, and a cast through `unknown` keeps compiling
    // however accurate the schema becomes - so it defeats the type checker
    // rather than answering it. `cms/menus` uses it correctly, over a
    // hand-written row type that declares column names only; this package
    // types its rows as `ModelRow`, where it never holds.
    const offenders: string[] = []

    for (const { path, source } of files) {
      for (const match of withoutComments(source).matchAll(/\basRows?</g))
        offenders.push(`${path}: ${match[0]}`)
    }

    expect(offenders).toEqual([])
  })
})
