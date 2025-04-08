import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Log',
  table: 'logs',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'type', 'source', 'message', 'project', 'timestamp'],
      searchable: ['message', 'project', 'file'],
      sortable: ['timestamp', 'type', 'source'],
      filterable: ['type', 'source', 'project'],
    },
  },

  attributes: {
    timestamp: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.date(),
        message: {
          date: 'Timestamp must be a valid date',
        },
      },
      factory: faker => faker.date.recent(),
    },

    type: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.enum(['warning', 'error', 'info', 'success']),
        message: {
          enum: 'Type must be one of: warning, error, info, success',
        },
      },
      factory: faker => faker.helpers.arrayElement(['warning', 'error', 'info', 'success']),
    },

    source: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.enum(['file', 'cli', 'system']),
        message: {
          enum: 'Source must be one of: file, cli, system',
        },
      },
      factory: faker => faker.helpers.arrayElement(['file', 'cli', 'system']),
    },

    message: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().minLength(1).maxLength(1000),
        message: {
          minLength: 'Message must not be empty',
          maxLength: 'Message must not exceed 1000 characters',
        },
      },
      factory: faker => faker.lorem.sentence(),
    },

    project: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().minLength(1).maxLength(255),
        message: {
          minLength: 'Project name must not be empty',
          maxLength: 'Project name must not exceed 255 characters',
        },
      },
      factory: faker => faker.company.name(),
    },

    stacktrace: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(5000),
        message: {
          maxLength: 'Stacktrace must not exceed 5000 characters',
        },
      },
      factory: faker => faker.lorem.paragraphs(2),
    },

    file: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          maxLength: 'File path must not exceed 255 characters',
        },
      },
      factory: faker => faker.system.filePath(),
    },
  },
} satisfies Model
