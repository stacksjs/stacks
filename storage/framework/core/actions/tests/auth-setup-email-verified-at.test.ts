import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1948 — `buddy auth:setup` must guarantee the
// `users.email_verified_at` column that `verifyEmail()` writes (no
// generated users migration creates it). setup.ts is a top-level
// script that calls process.exit, so it can't be imported in tests;
// like postgres-pivot-timestamptz.test.ts, the regression guard is a
// source-shape check.

describe('auth:setup ensures users.email_verified_at (stacksjs/stacks#1948)', () => {
  const setupPath = resolve(__dirname, '../src/auth/setup.ts')
  const source = readFileSync(setupPath, 'utf-8')

  it('executes the shared usersEmailVerifiedAtSql builder', () => {
    expect(source).toContain(`import { sqlHelpers, usersEmailVerifiedAtSql } from '@stacksjs/database'`)
    expect(source).toContain('await db.unsafe(usersEmailVerifiedAtSql(sql))')
  })

  it('wraps the ALTER in try/catch so auth:setup reruns are no-ops', () => {
    // Duplicate-column (rerun) and missing-users-table (auth:setup
    // before migrate) must both be swallowed.
    expect(source).toMatch(/try\s*\{\s*await db\.unsafe\(usersEmailVerifiedAtSql\(sql\)\)\s*\}\s*catch/)
  })
})
