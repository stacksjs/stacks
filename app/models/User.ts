import { faker } from 'stacks/core/faker/src'
import { validate } from 'stacks/core/validation'
import type { Model } from 'stacks/core/types/src'

export default <Model> {
  name: 'User',
  searchable: true, // boolean | IndexSettings
  seeder: {
    count: 10,
  },
  fields: [
    {
      name: 'name',
      validation: validate.string().min(3).max(255),
      factory: () => faker.name,
    },
    {
      name: 'email',
      validation: validate.string().min(1).max(255),
      unique: true,
      factory: () => faker.internet.email,
    },
    {
      name: 'password',
      validation: validate.string().min(6).max(255),
      factory: () => faker.internet.password(),
    },
  ],
}
