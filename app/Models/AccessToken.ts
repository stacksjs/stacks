import type { Model } from '@stacksjs/types'
import { collect } from '@stacksjs/collections'
import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'

export default {
  name: 'AccessToken',
  description: 'An access token for a user',
  table: 'personal_access_tokens',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['Team', 'User'], // Added User relation
  traits: {
    useTimestamps: true,
    useSeeder: {
      count: 10,
    },
  },

  attributes: {
    name: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'name must be a string',
          required: 'name is required',
        },
      },
      factory: () => faker.lorem.sentence({ min: 3, max: 6 }),
    },

    token: {
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().maxLength(512),
        message: {
          string: 'token must be a string',
          required: 'token is required',
          maxLength: 'token must have a maximum of 512 characters',
        },
      },
      factory: () => faker.string.uuid(),
    },

    plainTextToken: {
      fillable: true,
      validation: {
        rule: schema.string().maxLength(512),
        message: {
          string: 'plainTextToken must be a string',
          required: 'plainTextToken is required',
          maxLength: 'plainTextToken must have a maximum of 512 characters',
        },
      },
      factory: () => faker.string.uuid(),
    },

    abilities: {
      fillable: true,
      validation: {
        rule: schema.enum(['read', 'write', 'admin', 'read|write', 'read|admin', 'write|admin', 'read|write|admin']),
        message: {
          required: 'abilities is required',
          maxLength: 'plainTextToken must have a maximum of 512 characters',
          string: '`abilities` must be string of either `read`, `write`, `admin`, `read|write`, `read|admin`, `write|admin`, or `read|write|admin`',
        },
      },
      factory: () =>
        collect(['read', 'write', 'admin', 'read|write', 'read|admin', 'write|admin', 'read|write|admin']).random().first(),
    },

    // New columns
    lastUsedAt: {
      fillable: true,
      validation: {
        rule: schema.date(),
        message: {
          date: 'lastUsedAt must be a valid date',
        },
      },
      factory: () => faker.date.recent().toDateString(),
    },

    expiresAt: {
      fillable: true,
      validation: {
        rule: schema.date(),
        message: {
          date: 'expiresAt must be a valid date',
        },
      },
      factory: () => faker.date.future().toDateString(),
    },

    revokedAt: {
      fillable: true,
      validation: {
        rule: schema.date(),
        message: {
          date: 'revokedAt must be a valid date',
        },
      },
      factory: () => faker.date.future().toDateString(),
    },

    ipAddress: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'ipAddress must be a string',
        },
      },
      factory: () => faker.internet.ip(),
    },

    deviceName: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'deviceName must be a string',
        },
      },
      factory: () => `${faker.company.name()} Browser on ${faker.system.networkInterface()}`,
    },

    isSingleUse: {
      fillable: true,
      validation: {
        rule: schema.boolean(),
        message: {
          boolean: 'isSingleUse must be a boolean',
        },
      },
      factory: () => false,
    },
  },
} satisfies Model
