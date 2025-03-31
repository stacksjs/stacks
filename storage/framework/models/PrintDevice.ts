import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'PrintDevice',
  table: 'print_devices',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'mac_address', 'location', 'terminal', 'status', 'last_ping', 'print_count'],
      searchable: ['name', 'mac_address', 'location', 'terminal'],
      sortable: ['last_ping', 'print_count'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 5,
    },

    useApi: {
      uri: 'print-devices',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },

    observe: true,
  },

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Device name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.company.name(),
    },

    mac_address: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          maxLength: 'MAC address must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.internet.mac(),
    },

    location: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Location must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.location.streetAddress(),
    },

    terminal: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          maxLength: 'Terminal must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(10),
    },

    status: {
      required: true,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['online', 'offline', 'warning'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['online', 'offline', 'warning']),
    },

    last_ping: {
      required: true,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number(),
        message: {
          invalid: 'Invalid timestamp format',
        },
      },
      factory: faker => faker.date.recent(),
    },

    print_count: {
      required: true,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Print count cannot be negative',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 1000 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
