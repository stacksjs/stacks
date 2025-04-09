import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Category',
  table: 'categories',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'isActive', 'parentCategoryId', 'displayOrder'],
      searchable: ['name', 'description'],
      sortable: ['displayOrder', 'createdAt', 'updatedAt'],
      filterable: ['parentCategoryId', 'isActive'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'product-categories',
    },

    observe: true,
  },

  hasMany: ['Product'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          maxLength: 'Name must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.commerce.department(),
    },

    description: {
      required: false,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    imageUrl: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.image.url(),
    },

    isActive: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => true,
    },

    parentCategoryId: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => null, // Most categories won't have a parent
    },

    displayOrder: {
      required: true,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number(),
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
