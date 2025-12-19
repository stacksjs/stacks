import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'OAuthAccessToken',
  description: 'OAuth access tokens for API authentication',
  table: 'oauth_access_tokens',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['User', 'OAuthClient'],
  foreignKeys: [
    {
      foreignKey: 'user_id',
      references: 'id',
      table: 'users',
    },
    {
      foreignKey: 'oauth_client_id',
      references: 'id',
      table: 'oauth_clients',
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
          max: 'token must have a maximum of 512 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(80),
    },

    name: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          string: 'name must be a string',
          max: 'name must have a maximum of 255 characters',
        },
      },
      factory: () => 'auth-token',
    },

    scopes: {
      fillable: true,
      validation: {
        rule: schema.string().max(2000),
        message: {
          string: 'scopes must be a string',
          max: 'scopes must have a maximum of 2000 characters',
        },
      },
      factory: () => JSON.stringify(['read', 'write']),
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
        rule: schema.timestamp(),
        message: {
          timestamp: 'expiresAt must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },
  },
} satisfies Model
