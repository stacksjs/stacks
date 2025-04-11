import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'PostCategory',
  table: 'post_categories',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'slug'],
      searchable: ['name', 'description'],
      sortable: ['created_at'],
      filterable: ['name'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'post-categories',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsToMany: ['Post'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().minLength(2).maxLength(100),
        message: {
          minLength: 'Category name must have a minimum of 2 characters',
          maxLength: 'Category name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.word.noun(),
    },

    description: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().minLength(10).maxLength(500),
        message: {
          minLength: 'Description must have a minimum of 10 characters',
          maxLength: 'Description must have a maximum of 500 characters',
        },
      },
      factory: faker => faker.lorem.paragraph(),
    },

    slug: {
      required: true,
      order: 3,
      fillable: true,
      unique: true,
      validation: {
        rule: schema.string().minLength(2).maxLength(100),
        message: {
          minLength: 'Slug must have a minimum of 2 characters',
          maxLength: 'Slug must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.helpers.slugify(faker.word.noun()),
    },
  },
} satisfies Model
