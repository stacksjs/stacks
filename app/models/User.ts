import { faker } from '@stacksjs/faker'
import { validator } from '@stacksjs/validation'
import { defineModel } from '@stacksjs/config'

export default defineModel({
  name: 'User', // defaults to the sanitized file name
  table: 'users', // defaults to the lowercase, plural name of the model
  // primaryKey: 'id', // defaults to `id`
  // autoIncrement: true, // defaults to true
  useUuid: true, // instead of `auto-incrementing id`, defaults to false
  searchable: true, // defaults to false, also accepts SearchEngineSettings
  seedable: { // defaults to a count of 10
    count: 10,
  },

  // authenticatable: true, // defaults to false, also accepts AuthSettings or TokenSettings

  fields: {
    name: {
      default: 'test',
      validator: {
        rule: validator.string().minLength(3).maxLength(255),
        message: 'Name must be between 3 and 255 characters',
      },

      factory: () => faker.person.fullName(),
    },

    email: {
      unique: true,
      default: 'test email',
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
})
