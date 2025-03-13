// soon, these will be auto-imported
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
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
      required: true,
      validation: {
        rule: schema.string().minLength(3).maxLength(255),
        message: {
          minLength: 'Name must have a minimum of 3 characters',
          maxLength: 'Name must have a maximum of 255 characters',
        },
      },

      factory: faker => faker.person.fullName(),
    },

    version: {
      required: true,
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().maxLength(255),
        message: {
          email: 'Version must be a valid version',
        },
      },

      factory: faker => faker.internet.email(),
    },
  },
} satisfies Model
