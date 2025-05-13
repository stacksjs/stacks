import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

export default {
  name: 'ProductUnit',
  table: 'product_units',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'abbreviation', 'type', 'description', 'isDefault'],
      searchable: ['name', 'abbreviation', 'type', 'description'],
      sortable: ['name', 'type', 'createdAt', 'updatedAt'],
      filterable: ['type', 'isDefault'],
    },

    useSeeder: {
      count: 10,
    },

    useApi: {
      uri: 'product-units',
    },

    observe: true,
  },

  belongsTo: ['Product'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().max(100),
        message: {
          maxLength: 'Name must have a maximum of 100 characters',
        },
      },
      factory: (faker) => {
        const units = ['Piece', 'Kilogram', 'Gram', 'Liter', 'Milliliter', 'Meter', 'Centimeter', 'Box', 'Pack', 'Pair']
        return faker.helpers.arrayElement(units)
      },
    },

    abbreviation: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().max(10),
        message: {
          maxLength: 'Abbreviation must have a maximum of 10 characters',
        },
      },
      factory: (faker) => {
        const abbrs = ['pc', 'kg', 'g', 'L', 'mL', 'm', 'cm', 'box', 'pk', 'pr']
        return faker.helpers.arrayElement(abbrs)
      },
    },

    type: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'Type must be a string',
        },
      },
      factory: (faker) => {
        const types = ['Weight', 'Volume', 'Length', 'Quantity', 'Size']
        return faker.helpers.arrayElement(types)
      },
    },

    description: {
      required: false,
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          maxLength: 'Description must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.lorem.sentence(),
    },

    isDefault: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.boolean(),
        message: {
          boolean: 'Default status must be a boolean',
        },
      },
      factory: faker => faker.datatype.boolean(0.2), // 20% chance of being default
    },
  },

  dashboard: {
    highlight: true,
  },
} satisfies Model
