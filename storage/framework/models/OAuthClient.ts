import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'OAuthClient',
  description: 'OAuth client for API authentication',
  table: 'oauth_clients',
  primaryKey: 'id',
  autoIncrement: true,
  traits: {
    useTimestamps: true,
  },

  attributes: {
    name: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          string: 'name must be a string',
          required: 'name is required',
          max: 'name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.company.name(),
    },

    secret: {
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          string: 'secret must be a string',
          max: 'secret must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(80),
    },

    provider: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          string: 'provider must be a string',
          max: 'provider must have a maximum of 255 characters',
        },
      },
      factory: () => 'local',
    },

    redirect: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(2000),
        message: {
          string: 'redirect must be a string',
          required: 'redirect is required',
          max: 'redirect must have a maximum of 2000 characters',
        },
      },
      factory: () => 'http://localhost',
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
