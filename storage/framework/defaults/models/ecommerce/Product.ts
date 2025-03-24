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
      displayable: ['id', 'name', 'description', 'price', 'category_id', 'is_available', 'inventory_count'],
      searchable: ['name', 'description', 'category_id'],
      sortable: ['price', 'created_at', 'updated_at', 'inventory_count', 'preparation_time'],
      filterable: ['category_id', 'is_available', 'allergens'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'products',
      routes: ['index', 'store', 'show'],
    },

    observe: true,
  },

  belongsTo: ['Category', 'Manufacturer'],

  hasMany: ['Review', 'ProductUnit', 'ProductVariant', 'LicenseKey'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
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

    price: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.number().min(0.01),
        message: {
          min: 'Price must be at least 0.01',
        },
      },
      factory: faker => Number.parseFloat(faker.commerce.price({ min: 0.01, max: 1000, dec: 2 })),
    },

    image_url: {
      required: false,
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

    is_available: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => true,
    },

    inventory_count: {
      required: false,
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

    preparation_time: {
      required: true,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(1),
        message: {
          min: 'Preparation time must be at least 1 minute',
        },
      },
      factory: faker => faker.number.int({ min: 1, max: 60 }),
    },

    allergens: {
      required: false,
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

    nutritional_info: {
      required: false,
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
