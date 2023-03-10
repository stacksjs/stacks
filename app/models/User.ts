import { faker } from '../../.stacks/core/faker/src' // stacks/faker or @stacksjs/faker
import { validate } from '../../.stacks/core/validation/src' // stacks/validate or @stacksjs/validate
import type { Model } from '../../.stacks/core/types/src' // stacks/types or @stacksjs/types

export default <Model> {
  name: 'User',
  searchable: true, // boolean | IndexSettings,
  authenticatable: true, // boolean | AuthSettings,
  seeder: {
    count: 10,
  },
  fields: {
    name: {
      validation: validate.string().min(3).max(255),
      factory: () => faker.name,
    },
    email: {
      validation: validate.string().min(1).max(255),
      unique: true,
      factory: () => faker.internet.email,
    },
    password: {
      validation: validate.string().min(6).max(255),
      factory: () => faker.internet.password(),
    },
  },
}
