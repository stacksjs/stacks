import { faker } from '@stacksjs/faker'
import type { Model } from '@stacksjs/types'

export default <Model> {
  name: 'User',
  searchable: true, // boolean | IndexSettings
  seeder: { // <boolean | { count: number }>
    count: 10,
  },
  fields: [
    {
      name: 'name',
      type: 'String',
      unique: true,
      factory: () => faker.name,
    },
    {
      name: 'email',
      type: 'String',
      unique: true,
    },
    {
      name: 'password',
      type: 'String',
    },
  ],
}
