import { faker } from '@stacksjs/faker'
import { validator } from '@stacksjs/validation'
import type { Model } from '@stacksjs/types'

export default {
  name: 'Subscriber',
  table: 'subscribers',
  // primaryKey: 'id', // defaults to `id`
  // autoIncrement: true, // defaults to true

  // "traits"
  // useUuid: true, // instead of `auto-incrementing id`, defaults to false
  useSoftDeletes: true, // defaults to false, also accepts SearchEngineSettings
  useSeeder: { // defaults to a count of 10
    count: 10,
  },

  belongsTo: 'User',

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
