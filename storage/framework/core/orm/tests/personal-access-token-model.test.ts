import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The Sanctum-shaped token model maps the table the auth layer already owns.
 *
 * `@stacksjs/auth` has issued and checked named, scoped API tokens for a long
 * time - `createToken(userId, name, scopes)`, `tokenCan`, `tokenCanAll`,
 * `tokenAbilities`, revocation - all against `oauth_access_tokens`. What it had
 * no model for was the row, so `User.hasMany('PersonalAccessToken')` named
 * nothing and threw `no such table: personal_access_tokens` for anyone who used
 * the relation the ORM listed as available.
 *
 * The model must map that same table and not invent a second one, or the auth
 * layer and the ORM would each hold half a user's tokens. Verified live before
 * this was written: a token minted by `createToken` came back through
 * `PersonalAccessToken.where('name', …)` with its scopes intact, and
 * `auth.tokens(userId)` and the model agreed on the count.
 */

const model = readFileSync(
  join(import.meta.dir, '..', '..', '..', 'defaults', 'app', 'Models', 'PersonalAccessToken.ts'),
  'utf8',
)

describe('the PersonalAccessToken model', () => {
  it('maps the table the auth layer writes to', () => {
    expect(model).toContain("table: 'oauth_access_tokens'")
    // A second table would split a user's tokens between two stores.
    expect(model).not.toContain("table: 'personal_access_tokens'")
  })

  it('belongs to the user the auth layer keys tokens by', () => {
    expect(model).toContain("belongsTo: ['User']")
  })

  /**
   * `createToken` returns the plaintext once and stores only a hash. Serialising
   * that hash would put a credential in every API response that includes a
   * token row, and mass assignment could otherwise overwrite it.
   */
  it('keeps the stored token out of responses and out of mass assignment', () => {
    const token = /token:\s*\{([\s\S]*?)\n    \}/.exec(model)?.[1] ?? ''

    expect(token).toContain('hidden: true')
    expect(token).toContain('guarded: true')
    expect(token).not.toContain('fillable: true')
  })

  /**
   * A generic `store` would insert a row whose plaintext nobody ever saw, since
   * only `createToken` returns it.
   */
  it('exposes no store route', () => {
    const routes = /routes:\s*\[([^\]]*)\]/.exec(model)?.[1] ?? ''

    expect(routes).toContain("'index'")
    expect(routes).toContain("'destroy'")
    expect(routes).not.toContain("'store'")
  })
})

describe('User', () => {
  const user = readFileSync(
    join(import.meta.dir, '..', '..', '..', 'defaults', 'app', 'Models', 'User.ts'),
    'utf8',
  )

  it('relates to its personal access tokens', () => {
    const hasMany = /hasMany:\s*\[([\s\S]*?)\]/.exec(user)?.[1] ?? ''

    expect(hasMany).toContain("'PersonalAccessToken'")
  })
})
