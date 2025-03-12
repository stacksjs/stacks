import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ProductCategory',
  table: 'product_categories',
  primaryKey: 'id',
  autoIncrement: false, // Using UUID instead of auto-increment

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'is_active', 'parent_category_id', 'display_order'],
      searchable: ['name', 'description'],
      sortable: ['display_order', 'created_at', 'updated_at'],
      filterable: ['parent_category_id', 'is_active'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'product-categories',
      routes: ['index', 'store', 'show'],
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

    image_url: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.image.url(),
    },

    is_active: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => true,
    },

    parent_category_id: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => null, // Most categories won't have a parent
    },

    display_order: {
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
