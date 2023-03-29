import { faker } from '../../.stacks/core/faker/src' // stacks/faker or @stacksjs/faker
import { validate } from '../../.stacks/core/validation/src' // stacks/validate or @stacksjs/validate
import type { Model } from '../../.stacks/core/types/src' // stacks/types or @stacksjs/types

enum Type {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Date = 'Date',
  Object = 'Object',
  Array = 'Array',
}

export default <Model> {
  name: 'User',
  table: 'users',
  authenticatable: true, // boolean | AuthSettings (including TokenSettings),
  searchable: true, // boolean | IndexSettings,
  seedable: { // boolean | SeedSettings,
    count: 10,
  },
  fields: {
    name: {
      type: Type.String,
      validation: validate.string().min(3).max(255),
      factory: () => faker.name.firstName(),
    },
    email: {
      type: Type.String,
      validation: validate.string().min(1).max(255),
      unique: true,
      factory: () => faker.internet.email(),
    },
    password: {
      type: Type.String,
      validation: validate.string().min(6).max(255),
      factory: () => faker.internet.password(),
    },
  },
}
