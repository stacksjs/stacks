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
  },

  attributes: {
    name: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(191),
        message: {
          string: 'name must be a string',
          required: 'name is required',
          max: 'name must have a maximum of 191 characters',
        },
      },
    },

    secret: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
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
        rule: schema.string().required().max(191),
        message: {
          string: 'provider must be a string',
          max: 'provider must have a maximum of 191 characters',
        },
      },
    },

    redirect: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(191),
        message: {
          string: 'redirect must be a string',
          required: 'redirect is required',
          max: 'redirect must have a maximum of 191 characters',
        },
      },
    },

    personalAccessClient: {
      fillable: true,
      validation: {
        rule: schema.boolean().required(),
        message: {
          boolean: 'personalAccessClient must be a boolean',
          required: 'personalAccessClient is required',
        },
      },
      factory: () => false,
    },

    passwordClient: {
      fillable: true,
      validation: {
        rule: schema.boolean().required(),
        message: {
          boolean: 'passwordClient must be a boolean',
          required: 'passwordClient is required',
        },
      },
      factory: () => false,
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
  },
} satisfies Model
