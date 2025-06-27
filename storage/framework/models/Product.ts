import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Product',
  table: 'products',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'description', 'price', 'categoryId', 'isAvailable', 'inventoryCount'],
      searchable: ['name', 'description', 'categoryId'],
      sortable: ['price', 'createdAt', 'updatedAt', 'inventoryCount', 'preparationTime'],
      filterable: ['categoryId', 'isAvailable', 'allergens'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'products',
    },

    observe: true,
  },

  belongsTo: ['Category', 'Manufacturer'],

  hasMany: ['Review', 'ProductUnit', 'ProductVariant', 'LicenseKey', 'WaitlistProduct', 'Coupon'],

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    description: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    price: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0.01),
        message: {
          min: 'Price must be at least 0.01',
        },
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0.01, max: 1000, dec: 2 })),
    },

    imageUrl: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'Image URL must be a string',
        },
      },
      factory: faker => faker.image.url(),
    },

    isAvailable: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => true,
    },

    inventoryCount: {
      order: 6,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Inventory count must be at least 0',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    preparationTime: {
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().required().min(1),
        message: {
          min: 'Preparation time must be at least 1 minute',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 60 }),
    },

    allergens: {
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        const possibleAllergens = ['Gluten', 'Dairy', 'Nuts', 'Soy', 'Eggs', 'Fish', 'Shellfish']
        const count = faker.number.int({ min: 0, max: 3 })
        const allergens = faker.helpers.arrayElements(possibleAllergens, count)
        return JSON.stringify(allergens)
      },
    },

    nutritionalInfo: {
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        return JSON.stringify({
          calories: faker.number.int({ min: 50, max: 800 }),
          fat: faker.number.float({ min: 0, max: 50 }),
          protein: faker.number.float({ min: 0, max: 30 }),
          carbs: faker.number.float({ min: 0, max: 100 }),
        })
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
