// soon, these will be auto-imported
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Release', // defaults to the sanitized file name
  table: 'releases', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useTimestamps: true, // defaults to true, `timestampable` used as an alias

    useSeeder: {
      // defaults to a count of 10, `seedable` used as an alias
      count: 100,
    },
  },

  attributes: {
    name: {
      validation: {
        rule: schema.string().required().min(3).max(255),
        message: {
          min: 'Name must have a minimum of 3 characters',
          max: 'Name must have a maximum of 255 characters',
        },
      },

      factory: faker => faker.person.fullName(),
    },

    version: {
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          max: 'Version must have a maximum of 255 characters',
        },
      },

      factory: faker => faker.system.semver(),
    },

    releaseNotes: {
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.lorem.paragraph(),
    },

    status: {
      fillable: true,
      validation: {
        rule: schema.enum(['draft', 'published', 'deprecated']),
      },
      factory: faker => faker.helpers.arrayElement(['draft', 'published', 'published', 'deprecated']),
    },

    downloadCount: {
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 10000 }),
    },
  },
} as const)
