import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Request',
  table: 'requests',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSoftDeletes: true,
    useSeeder: {
      count: 50,
    },
    useApi: true,
  },

  attributes: {
    method: {
      fillable: true,
      validation: {
        rule: schema.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD']),
        message: {
          enum: 'method must be a valid HTTP method',
          required: 'method is required',
        },
      },
      factory: faker => faker.helpers.arrayElement(['GET', 'POST', 'PUT', 'DELETE']),
    },

    path: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'path must be a string',
          required: 'path is required',
        },
      },
      factory: faker => faker.internet.url(),
    },

    status_code: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'status_code must be a number',
          required: 'status_code is required',
        },
      },
      factory: faker => faker.helpers.arrayElement([200, 201, 400, 401, 403, 404, 500]),
    },

    duration_ms: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'duration_ms must be a number',
          required: 'duration_ms is required',
        },
      },
      factory: faker => faker.number.int({ min: 50, max: 1000 }),
    },

    ip_address: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'ip_address must be a string',
          required: 'ip_address is required',
        },
      },
      factory: faker => faker.internet.ip(),
    },

    memory_usage: {
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          number: 'memory_usage must be a number in MB',
          required: 'memory_usage is required',
        },
      },
      factory: faker => faker.number.int({ min: 50, max: 512 }),
    },

    user_agent: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'user_agent must be a string',
        },
      },
      factory: faker => faker.internet.userAgent(),
    },

    error_message: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'error_message must be a string',
        },
      },
      factory: faker => faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.2 }),
    },
  },
} satisfies Model
