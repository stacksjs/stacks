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
      required: true,
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
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          max: 'Document name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.system.fileName(),
    },

    timestamp: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          invalid: 'Invalid date format',
        },
      },
      factory: faker => faker.date.recent().toISOString(),
    },

    status: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.enum(['success', 'failed', 'warning'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['success', 'failed', 'warning']),
    },

    size: {
      required: false,
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
      required: false,
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
      required: false,
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
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => ({
        lorem: faker.lorem.sentence(),
      }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
