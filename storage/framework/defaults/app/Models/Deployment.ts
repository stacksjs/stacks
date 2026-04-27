import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Deployment',
  table: 'deployments',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'commitHash', 'branch', 'status', 'duration', 'createdAt'],
      searchable: ['commitHash', 'branch', 'status', 'author'],
      sortable: ['createdAt', 'updatedAt', 'duration'],
      filterable: ['status', 'branch', 'environment'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'deployments',
      routes: ['index', 'show'],
    },
  },

  attributes: {
    commitHash: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().min(7).max(40),
      },
      factory: faker => faker.git.commitSha().substring(0, 7),
    },

    commitMessage: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: faker => faker.git.commitMessage(),
    },

    branch: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
      },
      factory: faker => faker.helpers.arrayElement(['main', 'develop', 'staging', 'feature/auth', 'feature/api', 'fix/hotfix']),
    },

    status: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['success', 'failed', 'pending', 'running', 'cancelled']),
    },

    environment: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => faker.helpers.arrayElement(['production', 'staging', 'development']),
    },

    duration: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 15, max: 120 }),
    },

    author: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
      },
      factory: faker => faker.person.fullName(),
    },

    url: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.string().max(500),
      },
      factory: faker => faker.internet.url(),
    },

    errorLog: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => undefined,
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
