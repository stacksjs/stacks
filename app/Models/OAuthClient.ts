import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'OauthClient',
  description: 'An OAuth 2.0 client application',
  table: 'oauth_clients',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['User'],
  hasMany: ['OauthAccessToken'],
  traits: {
    useTimestamps: true,
    useSeeder: {
      count: 10,
    },
  },

  attributes: {
    name: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.string().max(191),
        message: {
          string: 'name must be a string',
          required: 'name is required',
          max: 'name must have a maximum of 191 characters',
        },
      },
    },

    secret: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          string: 'secret must be a string',
          required: 'secret is required',
          max: 'secret must have a maximum of 100 characters',
        },
      },
    },

    provider: {
      fillable: true,
      validation: {
        rule: schema.string().max(191),
        message: {
          string: 'provider must be a string',
          max: 'provider must have a maximum of 191 characters',
        },
      },
    },

    redirect: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.string().max(191),
        message: {
          string: 'redirect must be a string',
          required: 'redirect is required',
          max: 'redirect must have a maximum of 191 characters',
        },
      },
    },

    personalAccessClient: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.boolean(),
        message: {
          boolean: 'personalAccessClient must be a boolean',
          required: 'personalAccessClient is required',
        },
      },
      factory: () => false,
    },

    passwordClient: {
      fillable: true,
      required: true,
      validation: {
        rule: schema.boolean(),
        message: {
          boolean: 'passwordClient must be a boolean',
          required: 'passwordClient is required',
        },
      },
      factory: () => false,
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
  },
} satisfies Model
