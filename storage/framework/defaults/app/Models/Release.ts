import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Release',
  table: 'releases',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'version', 'type', 'status', 'createdAt'],
      searchable: ['version', 'type', 'notes'],
      sortable: ['createdAt', 'version'],
      filterable: ['type', 'status'],
    },

    useApi: {
      // Public catalog: anyone may browse, only authenticated callers may
      // write. Declared explicitly because the trait now defaults BOTH sides to
      // `auth` — an undeclared read route is how a customer list leaks
      // (stacksjs/stacks#2224). Behaviour here is unchanged.
      middleware: { read: [], write: ['auth'] },
      uri: 'releases',
      routes: ['index', 'show'],
    },
  },

  attributes: {
    version: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(50),
      },
      factory: faker => faker.system.semver(),
    },

    type: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['major', 'minor', 'patch']),
    },

    status: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['published', 'draft', 'scheduled']),
    },

    notes: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.paragraph(),
    },

    downloads: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 50000 }),
    },

    author: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.person.fullName(),
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
