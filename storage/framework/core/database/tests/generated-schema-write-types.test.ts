// What a write to a framework-default table accepts, against the COMMITTED
// `database/types.d.ts`.
//
// A type test, run by the compiler (`bun run typecheck:type-tests`). The
// motivating break: `PersonalAccessToken` declared every column
// `ensureAuthTables()` creates for `oauth_access_tokens` (`user_id`,
// `oauth_client_id`, ...), but the generated schema was not regenerated with
// it - here or in an app that upgraded. So `insertInto('oauth_access_tokens')
// .values({ user_id })`, the write `@stacksjs/auth` itself makes, stopped
// compiling the moment writes were checked against the generated columns.
// The columns are `guarded` on the model, and guarded is about mass assignment
// through the model API - it says nothing about whether the column exists.

/// <reference path="../../../../../database/types.d.ts" />

import type { DatabaseSchema } from '@stacksjs/database'
import { describe, expect, test } from 'bun:test'

// The table's columns as the generated file declares them. Read through
// `@stacksjs/database`, the specifier the generated augmentation targets (and
// the one an app's `db` resolves); `WriteOf` itself is covered by
// write-types.test.ts.
type TokenWrite = Partial<DatabaseSchema['oauth_access_tokens']>

function write(_row: TokenWrite): void {}

describe('a write to oauth_access_tokens', () => {
  test('takes the columns ensureAuthTables() creates, guarded ones included', () => {
    const now = new Date().toISOString()

    write({
      id: 1,
      user_id: 1,
      token: 'hash',
      name: 'cli',
      scopes: '["*"]',
      tokenable_type: 'users',
      tokenable_id: 1,
      created_at: now,
    })

    write({ oauth_client_id: 2, oauth_grant_id: 'grant', resources: '[]', audiences: '[]', workspace_id: 'w' })
    expect(true).toBe(true)
  })

  test('still rejects a column the table does not have', () => {
    // @ts-expect-error - no such column
    write({ usr_id: 1 })
    expect(true).toBe(true)
  })
})
