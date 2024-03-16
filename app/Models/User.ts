// soon, these will be auto-imported
import { faker } from '@stacksjs/faker'
import { validator } from '@stacksjs/validation'
import type { Model } from '@stacksjs/types'

export default {
  name: 'User', // defaults to the sanitized file name
  table: 'users', // defaults to the lowercase, plural name of the model
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useAuth: true, // defaults to false, `authenticatable` used as an alias
    useTimestamps: true, // defaults to true, `timestampable` used as an alias
    useSeeder: { // defaults to a count of 10, `seedable` used as an alias
      count: 10,
    },
    useSearch: true, // defaults to false, `searchable` used as an alias
    useSoftDeletes: true, // defaults to false, `softDeletable` used as an alias
    // useUuid: true, // defaults to false
  },

  fields: {
    name: {
      validator: {
        rule: validator.string().minLength(3).maxLength(255),
        message: 'Name must be between 3 and 255 characters',
      },

      factory: () => faker.person.fullName(),
    },

    email: {
      unique: true,
      validator: {
        rule: validator.string().email(),
        message: 'Email must be a valid email address',
      },

      factory: () => faker.internet.email(),
    },

    password: {
      validator: {
        rule: validator.string().minLength(6).maxLength(255),
        message: 'Password must be between 6 and 255 characters',
      },

      factory: () => faker.internet.password(),
    },
  },
} satisfies Model
