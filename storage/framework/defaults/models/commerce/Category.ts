import type { Model } from '@stacksjs/types'
import { slug } from '@stacksjs/strings'
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
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(50),
        message: {
          max: 'Name must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.commerce.department(),
    },

    description: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    slug: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required(),
      },
      factory: faker => slug(faker.commerce.department()),
    },

    imageUrl: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.image.url(),
    },

    isActive: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => true,
    },

    parentCategoryId: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: () => null, // Most categories won't have a parent
    },

    displayOrder: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().required(),
      },
      factory: faker => faker.number.int({ min: 1, max: 100 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
