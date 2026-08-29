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

/**
 * Strip every `${...}` from a template literal's raw text, leaving only the SQL
 * the author actually wrote.
 *
 * Brace-matched rather than regex-replaced: an interpolation can nest another
 * template literal with its own `${...}`, and a lazy `\$\{[^}]*\}` stops at the
 * inner closing brace. That left the `?` of a JS ternary behind and reported the
 * one statement in this package that is already correct.
 */
function withoutInterpolations(template: string): string {
  let out = ''
  let depth = 0

  for (let i = 0; i < template.length; i++) {
    const char = template[i]!

    if (depth === 0 && char === '$' && template[i + 1] === '{') {
      depth = 1
      i++
      continue
    }

    if (depth > 0) {
      if (char === '{')
        depth++
      else if (char === '}')
        depth--
      continue
    }

    out += char
  }

  return out
}

/**
 * Raw SQL in this package runs against SQLite, MySQL and Postgres, and the
 * three disagree about two things that are easy to hardcode without noticing.
 * Both of these shipped: coupon redemption and gift card redemption each threw
 * `operator does not exist: boolean = integer` on Postgres while passing every
 * test on SQLite.
 */
describe('raw SQL is dialect-portable', () => {
  it('never compares a boolean column against an integer literal', () => {
    // Postgres columns generated from `schema.boolean()` are real BOOLEANs, so
    // `is_active = 1` is a type error there. `sqlHelpers().boolTrue` renders
    // `true` on Postgres and `1` elsewhere.
    const offenders: string[] = []

    for (const { path, source } of files) {
      for (const match of source.matchAll(/\b(is_\w+|has_\w+)\s*=\s*[01]\b/g))
        offenders.push(`${path}: ${match[0]}`)
    }

    expect(offenders).toEqual([])
  })

  it('never hardcodes a positional placeholder in a db.unsafe statement', () => {
    // Postgres numbers its placeholders (`$1`), so a literal `?` is a syntax
    // error there. `sqlHelpers().param(n)` renders the right one per dialect.
    const offenders: string[] = []

    for (const { path, source } of files) {
      // Each `db.unsafe(` call, up to the closing backtick of its template.
      for (const call of source.matchAll(/db\.unsafe\(\s*`([\s\S]*?)`/g)) {
        const sql = withoutInterpolations(call[1]!)
        if (/=\s*\?|\(\s*\?|,\s*\?|\s\?\s/.test(sql))
          offenders.push(`${path}: hardcoded '?' placeholder`)
      }
    }

    expect(offenders).toEqual([])
  })

  it('resolves the dialect from the configured connection', () => {
    // A statement built with `sqlHelpers` has to be told which dialect it is
    // rendering for; defaulting to a literal would reintroduce the bug.
    const usingHelpers = files.filter(f => f.source.includes('sqlHelpers('))

    expect(usingHelpers.length).toBeGreaterThan(0)

    for (const { path, source } of usingHelpers)
      expect(`${path}: ${source.includes('env.DB_CONNECTION')}`).toBe(`${path}: true`)
  })
})
