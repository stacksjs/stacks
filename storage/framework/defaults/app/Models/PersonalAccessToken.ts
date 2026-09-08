import { defineModel } from '@stacksjs/orm'
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
    useApi: {
      uri: 'personal-access-tokens',
      // No `store`: a token is minted by `createToken`, which returns the
      // plaintext exactly once. A generic create would write a row nobody holds
      // the token for.
      routes: ['index', 'show', 'destroy'],
      middleware: ['auth'],
    },
  },

  belongsTo: ['User'],

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => `${faker.hacker.noun()}-token`,
    },

    token: {
      order: 2,
      // The stored hash. Never serialised, never mass-assignable.
      hidden: true,
      guarded: true,
      validation: {
        rule: schema.string(),
      },
    },

    scopes: {
      order: 3,
      type: 'text',
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => JSON.stringify(['*']),
    },

    revoked: {
      order: 4,
      fillable: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => false,
    },

    expiresAt: {
      order: 5,
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
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
    },

    ipAddress: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().max(45),
      },
    },
  },
} as const)
