import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'PrintDevice',
  table: 'print_devices',
  primaryKey: 'id',
  autoIncrement: true,
  hasMany: ['Receipt'],
  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'macAddress', 'location', 'terminal', 'status', 'lastPing', 'printCount'],
      searchable: ['name', 'macAddress', 'location', 'terminal'],
      sortable: ['lastPing', 'printCount'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 5,
    },

    useApi: {
      uri: 'print-devices',
    },

    observe: true,
  },

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Device name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.company.name(),
    },

    macAddress: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required().max(50),
        message: {
          max: 'MAC address must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.internet.mac(),
    },

    location: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Location must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.location.streetAddress(),
    },

    terminal: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required().max(50),
        message: {
          max: 'Terminal must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(10),
    },

    status: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['online', 'offline', 'warning']).required(),
      },
      factory: faker => faker.helpers.arrayElement(['online', 'offline', 'warning']),
    },

    lastPing: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.unix().required(),
        message: {
          invalid: 'Invalid timestamp format',
        },
      },
      factory: faker => faker.date.recent().getTime(),
    },

    printCount: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0),
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
