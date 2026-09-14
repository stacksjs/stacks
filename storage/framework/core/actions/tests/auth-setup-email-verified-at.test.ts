import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// stacksjs/stacks#1948: `buddy auth:setup` must guarantee the
// `users.email_verified_at` column that `verifyEmail()` writes (no
// generated users migration creates it). setup.ts is a top-level
// script that calls process.exit, so it can't be imported in tests;
// this guard pins delegation. The auth package's auth-setup-schema
// subprocess tests verify the columns and idempotence against real DBs.

describe('auth:setup ensures users.email_verified_at (stacksjs/stacks#1948)', () => {
  const setupPath = resolve(__dirname, '../src/auth/setup.ts')
  const source = readFileSync(setupPath, 'utf-8')

  it('delegates schema guarantees to the canonical auth migrator', () => {
    expect(source).toMatch(/import \{[^}]*\bmigrateAuthTables\b[^}]*\} from '@stacksjs\/database'/)
    expect(source).toContain('await migrateAuthTables(')
    expect(source).not.toContain('CREATE TABLE')
  })

  it('does not report a failed migration as a successful setup', () => {
    expect(source).toContain('if (!result.success)')
    expect(source).toContain('process.exit(1)')
  })
})
