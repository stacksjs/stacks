// soon, these will be auto-imported
import { faker } from '@stacksjs/faker'
import { capitalize } from '@stacksjs/strings'
import { rule } from '@stacksjs/validation'
import type { UserType as User } from '@stacksjs/orm'
import type { Model } from '@stacksjs/types'

export default {
  name: 'User', // defaults to the sanitized file name
  table: 'users', // defaults to the lowercase, plural name of the model name
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  traits: {
    useAuth: true, // defaults to false, `authenticatable` used as an alias
    useTimestamps: true, // defaults to true, `timestampable` used as an alias
    useSearch: true, // defaults to true, `searchable` used as an alias
    useSoftDeletes: true, // defaults to false, `softDeletable` used as an alias

    useSeeder: { // defaults to a count of 10, `seedable` used as an alias
      count: 10,
    },

    useApi: {
      uri: 'users', // defaults to the table name,
      middleware: ['auth'], // defaults to `[]`
      routes: {
        // defaults to all routes
        index: true,
        show: true,
        store: true,
        update: true,
        destroy: true,
      },
    },

    // useUuid: true, // defaults to false
  },

  fields: {
    name: {
      validator: {
        rule: rule.string().minLength(3).maxLength(255),
        message: 'Name must be between 3 and 255 characters',
      },

      factory: () => faker.person.fullName(),
    },

    email: {
      unique: true,
      validator: {
        rule: rule.string().email(),
        message: 'Email must be a valid email address',
      },

      factory: () => faker.internet.email(),
    },

    password: {
      validator: {
        rule: rule.string().minLength(6).maxLength(255),
        message: 'Password must be between 6 and 255 characters',
      },

      factory: () => faker.internet.password(),
    },
  },

  get: {
    fullName: (user: User) => capitalize(user.name),
  },

  set: {
    password: (password: string) => Bun.password.hash(password),
  },
} satisfies Model
