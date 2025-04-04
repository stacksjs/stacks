import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ProductVariant',
  table: 'product_variants',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'product_id', 'variant', 'type', 'description', 'options', 'status'],
      searchable: ['variant', 'type', 'description', 'options'],
      sortable: ['created_at', 'updated_at', 'variant', 'type', 'status'],
      filterable: ['product_id', 'type', 'status'],
    },

    useSeeder: {
      count: 50,
    },

    useApi: {
      uri: 'product-variants',
    },

    observe: true,
  },

  belongsTo: ['Product'],

  attributes: {
    variant: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(100),
        message: {
          maxLength: 'Variant name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.commerce.productAdjective(),
    },

    type: {
      required: true,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().maxLength(50),
        message: {
          maxLength: 'Type must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['color', 'size', 'material', 'style', 'configuration']),
    },

    description: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    options: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: (faker) => {
        const optionTypes = {
          color: ['Red', 'Blue', 'Green', 'Black', 'White', 'Yellow', 'Purple', 'Orange', 'Brown', 'Gray'],
          size: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL'],
          material: ['Cotton', 'Polyester', 'Wool', 'Silk', 'Leather', 'Metal', 'Wood', 'Plastic', 'Glass'],
          style: ['Casual', 'Formal', 'Sport', 'Vintage', 'Modern', 'Classic', 'Bohemian', 'Minimalist'],
          configuration: ['Standard', 'Deluxe', 'Premium', 'Basic', 'Pro', 'Ultimate', 'Limited Edition'],
        }

        const variantType = faker.helpers.arrayElement(Object.keys(optionTypes))
        const optionCount = faker.number.int({ min: 2, max: 5 })
        const selectedOptions = faker.helpers.arrayElements(optionTypes[variantType], optionCount)

        return JSON.stringify(selectedOptions)
      },
    },

    status: {
      required: true,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive', 'draft']),
        message: {
          enum: 'Status must be one of: active, inactive, draft',
        },
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive', 'draft']),
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
