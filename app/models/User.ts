import { faker } from '@stacksjs/faker'
import { validate } from '@stacksjs/validation'
import { defineModel } from '@stacksjs/utils'

export default defineModel({
  name: 'User', // defaults to the sanitized file name
  table: 'users', // defaults to the lowercase, plural name of the model

  authenticatable: true, // defaults to false, also accepts AuthSettings or TokenSettings
  searchable: true, // defaults to false, also accepts SearchEngineSettings
  seedable: { // defaults to true & count of ten
    count: 10,
  },

  fields: {
    name: {
      validator: {
        rule: validate.string().minLength(3).maxLength(255).nullable(),
        message: 'Name must be between 3 and 255 characters',
      },

      factory: () => faker.person.fullName(),
    },

    email: {
      unique: true,

      validator: {
        rule: validate.string().email(),
        message: 'Email must be a valid email address',
      },

      factory: () => faker.internet.email(),
    },

    password: {
      validator: {
        rule: validate.string().minLength(6).maxLength(255),
        message: 'Password must be between 6 and 255 characters',
      },

      factory: () => faker.internet.password(),
    },
  },
})
