import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * A single-use passwordless sign-in token. `token` stores the SHA-256 of the
 * raw value - deterministic, so consume is one indexed lookup, and with 256
 * bits of entropy in the raw token an offline attack on a fast hash is
 * irrelevant (deliberately NOT the bcrypt-and-scan of password resets).
 *
 * No `useApi`: these rows are written and consumed by the auth flow only.
 */
export default defineModel({
  name: 'MagicLinkToken',
  table: 'magic_link_tokens',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'magic_link_tokens_token_unique',
      columns: ['token'],
      unique: true,
    },
  ],

  traits: {
    useTimestamps: true,
  },

  belongsTo: ['User'],

  attributes: {
    email: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().email().max(255),
      },
      factory: faker => faker.internet.email(),
    },

    /** SHA-256 hex of the raw token. Never the raw value. */
    token: {
      required: true,
      order: 2,
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().min(64).max(64),
      },
      factory: faker => faker.string.hexadecimal({ length: 64, prefix: '' }).toLowerCase(),
    },

    expiresAt: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => new Date(Date.now() + 15 * 60_000).toISOString().slice(0, 19).replace('T', ' '),
    },

    consumedAt: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },

    /** Relative path the consumed link lands on. Validated relative-only. */
    redirectTo: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().max(2048),
      },
      factory: () => null,
    },

    /** The site whose primary host the link targets, on multi-site apps. */
    siteId: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
      },
      factory: () => null,
    },
  },
} as const)
