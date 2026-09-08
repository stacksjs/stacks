import { defineModel, selfOwnership } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A named API token belonging to a user - the Sanctum shape.
 *
 * Maps the table the auth layer already owns rather than introducing a second
 * one. `@stacksjs/auth` issues these through `createToken(userId, name, scopes)`
 * and checks them with `tokenCan` / `tokenCanAll` / `tokenAbilities`; what was
 * missing was the model, so `User.hasMany('PersonalAccessToken')` named
 * something real and a token list could be queried, related and exposed like
 * any other row.
 *
 * `oauth_access_tokens` is created by `ensureAuthTables()` rather than by a
 * migration, the same as `notifications` - which is why nothing here declares
 * columns the auth layer does not already define.
 *
 * The token column holds a HASH, never the plaintext: `createToken` returns the
 * plaintext once, to the caller, and it is not recoverable afterwards. It is
 * `hidden` so it cannot leave through a serialised response, and `guarded` so
 * no mass assignment can set it.
 */
export default defineModel({
  name: 'PersonalAccessToken',
  table: 'oauth_access_tokens',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    // Deliberately no `useApi`.
    //
    // Minting and revoking both have semantics a generic CRUD route does not
    // carry. `createToken` returns the plaintext exactly once, so a generic
    // `store` would write a row nobody holds the token for; and revocation has
    // to take the paired refresh token with it (stacksjs/stacks#2306), which a
    // row delete does not. `@stacksjs/auth` owns both operations.
    //
    // It also keeps the write surface honest: row scoping compares ONE field,
    // and this table's owner is a `tokenable_type` / `tokenable_id` pair - so a
    // generated `destroy` scoped to `tokenable_id` alone would let a user
    // destroy an author's token whenever the two ids happened to match.
  },

  /**
   * Rows belong to whoever the pair names. Declared even with no generated
   * routes, so adding `useApi` later cannot ship an unscoped write by omission
   * (stacksjs/stacks#2375) - though see the note above about the one field this
   * can express.
   */
  ownership: selfOwnership('tokenable_id'),

  // No `belongsTo`: the owner is polymorphic. `tokenable_type` names the
  // owner's table, so a users-only foreign key would be a claim the column no
  // longer makes - and the FK preflight reported exactly that once the legacy
  // `user_id` stopped being the owner.
  attributes: {
    /**
     * The owner: the table it lives in, and its id there.
     *
     * Declared so the generated row type carries them. They are written by
     * `@stacksjs/auth` when a token is minted and never by a caller, so both
     * are guarded - an owner a request could set is an owner a request could
     * change.
     */
    tokenableType: {
      order: 1,
      guarded: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: () => 'users',
    },

    tokenableId: {
      order: 2,
      guarded: true,
      validation: {
        rule: schema.number(),
      },
      factory: () => 1,
    },

    name: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => `${faker.hacker.noun()}-token`,
    },

    token: {
      order: 4,
      // The stored hash. Never serialised, never mass-assignable.
      hidden: true,
      guarded: true,
      validation: {
        rule: schema.string(),
      },
    },

    scopes: {
      order: 5,
      type: 'text',
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => JSON.stringify(['*']),
    },

    revoked: {
      order: 6,
      fillable: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => false,
    },

    expiresAt: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
    },

    /**
     * What the browser called itself, and where it came from.
     *
     * So a person can recognise their own sessions on a list well enough to
     * revoke one. Untrusted - a client chooses the string - which is why
     * nothing authorises on either.
     */
    userAgent: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    ipAddress: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().max(45),
      },
    },
  },
} as const)
