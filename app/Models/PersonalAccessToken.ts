import type { Model } from '@stacksjs/types'
import { collect } from '@stacksjs/collections'
import { schema } from '@stacksjs/validation'

export default {
  name: 'PersonalAccessToken',
  description: 'A personal access token for direct user authentication',
  table: 'personal_access_tokens',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['User'],
  traits: {
    useTimestamps: true,
  },

  attributes: {
    name: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          string: 'name must be a string',
          required: 'name is required',
        },
      },
      factory: faker => faker.lorem.sentence({ min: 3, max: 6 }),
    },

    token: {
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().max(512),
        message: {
          string: 'token must be a string',
          required: 'token is required',
          max: 'token must have a maximum of 512 characters',
        },
      },
      factory: faker => faker.string.uuid(),
    },

    plainTextToken: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(512),
        message: {
          string: 'plainTextToken must be a string',
          required: 'plainTextToken is required',
          max: 'plainTextToken must have a maximum of 512 characters',
        },
      },
      factory: faker => faker.string.uuid(),
    },

    abilities: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          required: 'abilities is required',
          string: '`abilities` must be string of either `read`, `write`, `admin`, `read|write`, `read|admin`, `write|admin`, or `read|write|admin`',
        },
      },
      factory: () =>
        collect(['read', 'write', 'admin', 'read|write', 'read|admin', 'write|admin', 'read|write|admin']).random().first(),
    },

    lastUsedAt: {
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'lastUsedAt must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.recent()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
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

    revokedAt: {
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'revokedAt must be a valid timestamp',
        },
      },
      factory: (faker) => {
        const date = faker.date.future()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    ipAddress: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'ipAddress must be a string',
        },
      },
      factory: faker => faker.internet.ip(),
    },

    deviceName: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'deviceName must be a string',
        },
      },
      factory: faker => `${faker.company.name()} Browser on ${faker.system.networkInterface()}`,
    },

    isSingleUse: {
      fillable: true,
      validation: {
        rule: schema.boolean().required(),
        message: {
          boolean: 'isSingleUse must be a boolean',
        },
      },
      factory: () => false,
    },
  },
} satisfies Model
