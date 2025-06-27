import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'OauthAccessToken',
  description: 'An OAuth 2.0 access token for third-party applications',
  table: 'oauth_access_tokens',
  primaryKey: 'id',
  belongsTo: [
    {
      model: 'User',
      foreignKey: 'user_id',
    },
    {
      model: 'OauthClient',
      foreignKey: 'oauth_client_id',
    },
  ],
  traits: {
    useTimestamps: true,
  },

  attributes: {
    token: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(512),
        message: {
          string: 'token must be a string',
          required: 'token is required',
        },
      },
    },
    name: {
      fillable: true,
      validation: {
        rule: schema.string().max(512),
        message: {
          string: 'name must be a string',
          max: 'name must have a maximum of 191 characters',
        },
      },
    },

    scopes: {
      fillable: true,
      validation: {
        rule: schema.string().max(190),
        message: {
          string: 'scopes must be a string',
        },
      },
    },

    revoked: {
      fillable: true,
      validation: {
        rule: schema.boolean().required(),
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
        rule: schema.datetime(),
        message: {
          date: 'expiresAt must be a valid date',
        },
      },
    },
  },
} satisfies Model
