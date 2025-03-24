import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ProductItem',
  table: 'product_items',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'product_id', 'size', 'color', 'price', 'is_available', 'inventory_count'],
      searchable: ['name', 'size', 'color', 'product_id'],
      sortable: ['price', 'created_at', 'updated_at', 'inventory_count'],
      filterable: ['product_id', 'is_available', 'size', 'color'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'product-items',
      routes: ['index', 'store', 'show'],
    },

    observe: true,
  },

  belongsTo: ['Product', 'Manufacturer', 'Category'],

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

    size: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        const sizes = ['Small', 'Medium', 'Large', 'XL', 'XXL']
        return faker.helpers.arrayElement(sizes)
      },
    },

    color: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.color.human(),
    },

    price: {
      required: true,
      order: 5,
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
      order: 6,
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
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => true,
    },

    inventory_count: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
        message: {
          min: 'Inventory count must be at least 0',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    sku: {
      required: true,
      order: 9,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          maxLength: 'SKU must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(10).toUpperCase(),
    },

    custom_options: {
      required: false,
      order: 10,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        return JSON.stringify({
          engraving: faker.lorem.word(),
          packaging: faker.helpers.arrayElement(['Gift Wrap', 'Standard', 'Eco Packaging']),
        })
      },
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
