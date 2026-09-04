import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'bun:test'

describe('buddy launcher PATH precedence', () => {
  it('preserves an explicitly selected tool before the user-local fallback', () => {
    const launcher = readFileSync(resolve('buddy'), 'utf8')

    expect(launcher).toContain('PATH="${PANTRY_LOCAL_BIN}:${PATH}:${USER_LOCAL_BIN}"')
    expect(launcher).not.toContain('PATH="${PANTRY_LOCAL_BIN}:${USER_LOCAL_BIN}:${PATH}"')
  })
})
