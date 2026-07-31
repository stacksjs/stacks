import type { Attributes } from '@stacksjs/types'
import { defineModel, formatDate } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

function receiptTimestamp(value: unknown): string {
  if (typeof value === 'number')
    return formatDate(value <= 2147483647 ? value * 1000 : value)

  if (typeof value === 'string' && /^\d{10}$/.test(value))
    return formatDate(Number(value) * 1000)

  return formatDate(value as Date | string)
}

export default defineModel({
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
      middleware: ['auth'],
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
        rule: schema.timestampTz().required(),
        message: {
          invalid: 'Invalid date format',
        },
      },
      factory: faker => faker.date.recent().toISOString(),
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
      default: 0,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(100),
        message: {
          max: 'Size must be less than or equal to 100',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },

    pages: {
      default: 0,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(50),
        message: {
          max: 'Pages must be less than or equal to 50',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 50 }),
    },

    duration: {
      default: 0,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0).max(50),
        message: {
          max: 'Duration must be less than or equal to 50',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 50 }),
    },
    metadata: {
      order: 8,
      fillable: true,
      default: '{}',
      validation: {
        rule: schema.string(),
      },
    },
  },

  set: {
    timestamp: (attributes: Attributes) => receiptTimestamp(attributes.timestamp),
  },

  dashboard: {
    highlight: true,
  },
} as const)
