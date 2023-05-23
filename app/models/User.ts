import { faker } from 'stacks/core/faker/src'
import { validate } from 'stacks/core/validation/src'
import type { Model } from 'stacks/core/types/src'

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
      validation: validate.string().min(3).max(255),
      factory: () => faker.person.firstName(),
    },
    email: {
      validation: validate.string().min(1).max(255),
      unique: true,
      factory: () => faker.internet.email(),
    },
    password: {
      validation: validate.string().min(6).max(255),
      factory: () => faker.internet.password(),
    },
  },
  // dashboard: {
  //   cards: [
  //     {
  //       title: 'Users',
  //       icon: 'heroicon-o-user',
  //       color: 'primary',
  //       value: 'users',
  //       query: {
  //         model: 'User',
  //         count: true,

  // or

  // model: 'User',
  // count: true,
  // where: {
  //   id: 1,
  // },

  // or

  // model: 'User',
  // count: true,
  // where: {
  //   id: {
  //     $gt: 1,
  //   },
  // },

  // or

  // model: 'User',
  // count: true,
  // where: {
  //   id: {
  //     $in: [1, 2, 3],
  //   },
  // },

  // or

  // model: 'User',
  // count: true,
  // where: {
  //   id: {
  //     $notIn: [1, 2, 3],
  //   },
  // },

  // or

  // model: 'User',
  // count: true,
  // where: {
  //   id: {
  //     // $notIn: [1, 2, 3],
  //     $not: {
  //       $in: [1, 2, 3],
  //     },
  //   },
  // },
  //       }
  //     }
  //   ]
  // }
}
