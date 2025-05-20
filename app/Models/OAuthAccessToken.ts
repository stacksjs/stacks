import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'OAuthAccessToken',
  description: 'An OAuth 2.0 access token for third-party applications',
  table: 'oauth_access_tokens',
  primaryKey: 'id',
  belongsTo: ['User', 'OAuthClient'],
  traits: {
    useTimestamps: true,
    useSeeder: {
      count: 10,
    },
  },

  attributes: {
    clientId: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'clientId must be a number',
          required: 'clientId is required',
        },
      },
    },

    name: {
      fillable: true,
      validation: {
        rule: schema.string().max(191),
        message: {
          string: 'name must be a string',
          max: 'name must have a maximum of 191 characters',
        },
      },
    },

    scopes: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'scopes must be a string',
        },
      },
    },

    revoked: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.boolean(),
        message: {
          boolean: 'revoked must be a boolean',
          required: 'revoked is required',
        },
      },
      factory: () => false,
    },

    expiresAt: {
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'expiresAt must be a valid timestamp',
        },
      },
    },
  },
} satisfies Model
