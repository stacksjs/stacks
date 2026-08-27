import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

describe('bootstrap package apps', () => {
  it('recognizes an unvendored Stacks app', () => {
    const file = join(import.meta.dir, '../../../../../bootstrap')
    const source = readFileSync(file, 'utf8')
    expect(source).toContain('is_stacks_app()')
    expect(source).toContain('&& ! is_stacks_app')
    expect(source).toContain('"stacks"[[:space:]]*:')
  })

  it('publishes the root bootstrap as package-project support', () => {
    const build = readFileSync(join(import.meta.dir, '../../defaults/build.ts'), 'utf8')
    expect(build).toContain("'../../../../bootstrap'")
    expect(build).toContain("'project/bootstrap'")
  })
})
