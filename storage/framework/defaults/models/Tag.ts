import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Tag',
  table: 'tags',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 15,
    },
    useApi: {
      uri: 'tags',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  attributes: {
    name: {
      required: true,
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(50),
        message: {
          min: 'Tag name must have at least 2 characters',
          max: 'Tag name must have at most 50 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement([
        'javascript', 'typescript', 'vue', 'react', 'nodejs',
        'database', 'performance', 'security', 'api', 'testing',
        'devops', 'cloud', 'frontend', 'backend', 'mobile',
      ]),
    },

    slug: {
      required: true,
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string().min(2).max(50),
      },
      factory: (faker, attributes) => {
        const name = attributes?.name || faker.lorem.word()
        return name.toLowerCase().replace(/\s+/g, '-')
      },
    },

    description: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.lorem.sentence(),
    },

    postCount: {
      required: false,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    color: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.string().max(20),
      },
      factory: faker => faker.helpers.arrayElement(['blue', 'green', 'red', 'purple', 'yellow', 'orange', 'pink', 'gray']),
    },
  },
} as const)
