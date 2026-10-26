import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * `groupBy` takes its columns as separate arguments (stacksjs/stacks#2998).
 *
 * bun-query-builder's `groupBy(...columns)` reads an array as one argument,
 * and `String(['campaign_id', 'status'])` is `'campaign_id,status'`. That used
 * to reach the SQL as `GROUP BY campaign_id,status` and work by accident. Once
 * bun-query-builder started validating column references, it threw, and the
 * marketing Campaigns, Email lists and Notifications overview APIs answered
 * 503. The call sites type-checked because `db` is loosely typed there, so
 * nothing but this catches the array form.
 */
const root = join(import.meta.dir, '..', '..')
const transpiler = new Bun.Transpiler({ loader: 'ts' })

function arrayGroupByCalls(): string[] {
  const found: string[] = []
  const globs = ['storage/framework/core/*/src/**/*.ts', 'storage/framework/defaults/**/*.ts', 'app/**/*.ts']
  for (const pattern of globs) {
    for (const file of new Bun.Glob(pattern).scanSync({ cwd: root })) {
      if (file.endsWith('.test.ts') || file.endsWith('.d.ts'))
        continue
      const source = readFileSync(join(root, file), 'utf8')
      if (!source.includes('groupBy'))
        continue
      // Transpiled, so a comment that quotes the old form does not count.
      if (/\.groupBy\(\s*\[/.test(transpiler.transformSync(source)))
        found.push(file)
    }
  }
  return found.sort()
}

describe('query builder groupBy calls', () => {
  it('pass columns as arguments, never as an array', () => {
    expect(arrayGroupByCalls()).toEqual([])
  })
})
