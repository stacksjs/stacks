import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Team',
  table: 'teams',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'memberCount', 'createdAt'],
      searchable: ['name', 'description'],
      sortable: ['name', 'createdAt', 'updatedAt', 'memberCount'],
      filterable: ['status'],
    },

    useSeeder: {
      count: 5,
    },

    useApi: {
      uri: 'teams',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  attributes: {
    name: {
      order: 1,
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string().required().min(2).max(100),
      },
      factory: faker => faker.company.name(),
    },

    description: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: faker => faker.company.catchPhrase(),
    },

    memberCount: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 1, max: 20 }),
    },

    status: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive']),
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
