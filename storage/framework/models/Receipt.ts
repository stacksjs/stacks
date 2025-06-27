import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Receipt',
  table: 'receipts',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['PrintDevice'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'printer', 'document', 'timestamp', 'status', 'size', 'pages', 'duration'],
      searchable: ['printer', 'document'],
      sortable: ['timestamp', 'status', 'size', 'pages', 'duration'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 5,
    },

    useApi: {
      uri: 'print-logs',
    },

    observe: true,
  },

  attributes: {
    printer: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          max: 'Printer name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.company.name(),
    },

    document: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Document name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.system.fileName(),
    },

    timestamp: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.timestamp().required(),
        message: {
          invalid: 'Invalid date format',
        },
      },
      factory: (faker) => {
        const date = faker.date.recent()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },

    status: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.enum(['success', 'failed', 'warning']).required(),
      },
      factory: faker => faker.helpers.arrayElement(['success', 'failed', 'warning']),
    },

    size: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().max(100),
        message: {
          max: 'Size must be less than or equal to 100',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },

    pages: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().max(50),
        message: {
          max: 'Pages must be less than or equal to 50',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 50 }),
    },

    duration: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().max(50),
        message: {
          max: 'Duration must be less than or equal to 50',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 50 }),
    },
    metadata: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => 'test',
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
