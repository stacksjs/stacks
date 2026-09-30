// A `sql``` fragment renders every interpolated value as a literal `?`, and the
// query builder re-renders those for the connection's dialect when it compiles
// the statement. Read `.sql` and `.parameters` off the fragment and execute
// them yourself and nothing re-renders anything, so Postgres receives the `?`,
// parses it as an operator and rejects the following token.
//
// That cost a whole red suite: `findAuthUserRowByEmail` did exactly this, and
// because every login, password recovery, magic link and two-factor exchange
// resolves its user through it, the entire Postgres auth suite failed with
// `syntax error at or near "LIMIT"` - 37 characters away from the fault, and
// 126 times in one CI run (stacksjs/stacks#2842, fixed in d7b49fa7ac).
//
// It typechecks, and it passes on SQLite and MySQL, which both accept `?`. So
// the only cheap guard is to read the source.

import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const CORE = join(import.meta.dir, '../..')

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'tests')
      continue

    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      sourceFiles(full, found)
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts'))
      found.push(full)
  }
  return found
}

/** Strip comments, so prose about the pattern is not mistaken for the pattern. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

describe('a sql`` fragment is not executed outside the builder (#2842)', () => {
  const files = sourceFiles(join(CORE))

  it('scans a plausible number of core source files', () => {
    // A broken walk that finds nothing would make every assertion below vacuous.
    expect(files.length).toBeGreaterThan(500)
  })

  it('no source reads .sql off a fragment and passes it to unsafe()', () => {
    // `unsafe(x.sql, x.parameters)` - the exact shape that shipped the bug.
    const pattern = /\bunsafe\(\s*(\w+)\.sql\s*,\s*\1\.parameters\s*\)/
    const offenders = files.filter(file => pattern.test(code(readFileSync(file, 'utf8'))))

    expect(offenders.map(f => f.slice(CORE.length + 1))).toEqual([])
  })

  it('no source builds a query string from a fragment it then executes', () => {
    // The same mistake spelled across two statements: a `sql`` ` fragment
    // assigned to a name, then that name's `.sql` handed to `unsafe`.
    const offenders: string[] = []
    for (const file of files) {
      const source = code(readFileSync(file, 'utf8'))
      for (const [, name] of source.matchAll(/const\s+(\w+)\s*=\s*sql`/g)) {
        if (new RegExp(`unsafe\\(\\s*${name}\\.sql\\b`).test(source))
          offenders.push(`${file.slice(CORE.length + 1)} (${name})`)
      }
    }

    expect(offenders).toEqual([])
  })
})
