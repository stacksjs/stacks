import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'ProductVariant',
  table: 'product_variants',
  primaryKey: 'id',
  autoIncrement: true,

  // A reference table: no row here has a per-caller owner, so there is nothing
  // to scope by and writes are an administrative concern gated by `middleware`.
  // Declared rather than left silent so `security.api.rowScoping: 'deny'` can
  // tell "considered" from "nobody thought about it" (stacksjs/stacks#2375).
  ownership: false,

  // A SKU identifies a variant within its product. Unique per product rather
  // than globally, because two imported stores (or two products of one) can
  // legitimately reuse a code. NULLs never collide, so variants without a SKU
  // are unconstrained on every dialect.
  indexes: [
    { name: 'product_variants_product_sku_unique', columns: ['product_id', 'sku'], unique: true },
  ],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'productId', 'variant', 'type', 'sku', 'price', 'compareAtPrice', 'inventoryCount', 'description', 'options', 'status'],
      searchable: ['variant', 'type', 'sku', 'description', 'options'],
      sortable: ['createdAt', 'updatedAt', 'variant', 'type', 'status', 'price', 'inventoryCount'],
      filterable: ['productId', 'type', 'status', 'sku'],
    },

    useSeeder: {
      count: 50,
    },

    useApi: {
      // Public catalog: anyone may browse, only authenticated callers may
      // write. Declared explicitly because the trait now defaults BOTH sides to
      // `auth` — an undeclared read route is how a customer list leaks
      // (stacksjs/stacks#2224). Behaviour here is unchanged.
      middleware: { read: [], write: ['auth'] },
      uri: 'product-variants',
    },

    observe: true,
  },

  belongsTo: ['Product'],

  attributes: {
    variant: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Variant name must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.commerce.productAdjective(),
    },

    type: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required().max(50),
        message: {
          max: 'Type must have a maximum of 50 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['color', 'size', 'material', 'style', 'configuration']),
    },

    description: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.string(),
      },
      factory: faker => faker.commerce.productDescription(),
    },

    options: {
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

        const variantType = faker.helpers.arrayElement(Object.keys(optionTypes)) as keyof typeof optionTypes
        const optionCount = faker.number.int({ min: 2, max: 5 })
        const selectedOptions = faker.helpers.arrayElements(optionTypes[variantType], optionCount)

        return JSON.stringify(selectedOptions)
      },
    },

    status: {
      order: 7,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive', 'draft']).required(),
        message: {
          enum: 'Status must be one of: active, inactive, draft',
        },
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive', 'draft']),
    },

    sku: {
      order: 8,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          max: 'SKU must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.string.alphanumeric(10).toUpperCase(),
    },

    // Money is integer minor units (cents), never a float. NULL means the
    // variant has no price of its own and inherits `products.price`.
    price: {
      order: 9,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.number().integer().min(0),
        message: {
          min: 'Price must be at least 0',
        },
      },
      factory: faker => faker.number.int({ min: 100, max: 10000 }),
    },

    // The "was" price shown struck through, in minor units. NULL when the
    // variant is not on sale.
    compareAtPrice: {
      order: 10,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.number().integer().min(0),
        message: {
          min: 'Compare-at price must be at least 0',
        },
      },
      // Above the factory's highest `price`, so a seeded sale is always a discount.
      factory: faker => faker.datatype.boolean() ? faker.number.int({ min: 10001, max: 20000 }) : null,
    },

    // Units in stock. NULL means stock is not tracked for this variant,
    // which is different from 0 (tracked and sold out).
    inventoryCount: {
      order: 11,
      fillable: true,
      nullable: true,
      validation: {
        rule: schema.number().integer().min(0),
        message: {
          min: 'Inventory count must be at least 0',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
