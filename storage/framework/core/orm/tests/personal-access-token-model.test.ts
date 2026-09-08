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

  /**
   * The owner is a `tokenable_type` / `tokenable_id` pair, so a users-only
   * foreign key would be a claim the column no longer makes - the FK preflight
   * reported exactly that while `belongsTo: ['User']` was still there.
   */
  it('claims no users-only foreign key, because the owner is polymorphic', () => {
    expect(model).not.toContain("belongsTo: ['User']")
    expect(model).toContain("ownership: selfOwnership('tokenable_id')")
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
   * Minting and revoking both carry semantics a generic CRUD route does not.
   * `createToken` returns the plaintext once, so a generated `store` writes a
   * row nobody holds the token for; and revocation must take the paired refresh
   * token with it (#2306), which a row delete does not.
   *
   * It also keeps the write surface honest: row scoping compares one field, and
   * this table's owner is a pair - a `destroy` scoped to `tokenable_id` alone
   * would let a user destroy an author's token whenever the ids matched.
   */
  it('generates no CRUD routes', () => {
    // The prose mentions it; a declaration would be `useApi:`.
    expect(model).not.toContain('useApi:')
  })
})

describe('token owners', () => {
  const user = readFileSync(
    join(import.meta.dir, '..', '..', '..', 'defaults', 'app', 'Models', 'User.ts'),
    'utf8',
  )

  /**
   * Neither model declares the relation. `useAuth` confers it, which is what
   * the polymorphic pair is for: before it, tokens belonged to `user_id` and
   * only `User` could hold one however plainly another model declared itself
   * authenticatable.
   */
  it('do not restate the relation, because useAuth confers it', () => {
    expect(user).toContain('useAuth')
    expect(user).not.toContain("morphMany: { tokenable:")
  })

  it('include Author, which is the whole point of the pair', () => {
    const author = readFileSync(
      join(import.meta.dir, '..', '..', '..', 'defaults', 'app', 'Models', 'Content', 'Author.ts'),
      'utf8',
    )

    expect(author).toContain('useAuth')
    expect(author).not.toContain("morphMany: { tokenable:")
  })

  /** The conferral itself, rather than its absence from the two models. */
  it('get it from the trait, for any model that declares useAuth', () => {
    const defineModel = readFileSync(
      join(import.meta.dir, '..', 'src', 'define-model.ts'),
      'utf8',
    )

    expect(defineModel).toContain("tokenable: 'PersonalAccessToken'")
    // An explicit declaration has to win, or a model could not point the
    // relation somewhere else.
    expect(defineModel).toContain("!('tokenable' in declared)")
  })
})
