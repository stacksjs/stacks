import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Author',
  table: 'authors',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'user_id'],
      searchable: ['name'],
      sortable: ['created_at', 'name'],
      filterable: ['name', 'user_id'],
    },

    useSeeder: {
      count: 10,
    },
  },

  belongsTo: ['User'],

  hasMany: ['Post'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().minLength(3).maxLength(255),
        message: {
          minLength: 'Name must have a minimum of 3 characters',
          maxLength: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.person.fullName(),
    },
  },
} satisfies Model
