import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'TaxRate',
  table: 'tax_rates',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSearch: {
      displayable: ['id', 'name', 'rate', 'type', 'country', 'region', 'status', 'isDefault'],
      searchable: ['name', 'country', 'region'],
      sortable: ['name', 'rate', 'status', 'createdAt', 'updatedAt'],
      filterable: ['status', 'isDefault'],
    },

    useSeeder: {
      count: 5,
    },

    useApi: {
      // Public catalog: anyone may browse, only authenticated callers may
      // write. Declared explicitly because the trait now defaults BOTH sides to
      // `auth` — an undeclared read route is how a customer list leaks
      // (stacksjs/stacks#2224). Behaviour here is unchanged.
      middleware: { read: [], write: ['auth'] },
      uri: 'tax-rates',
    },

    observe: true,
  },

  attributes: {
    name: {
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          max: 'Name must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.commerce.productName(),
    },

    rate: {
      order: 2,
      fillable: true,
      validation: {
        rule: schema.number().required().min(0).max(100),
        message: {
          min: 'Rate must be greater than or equal to 0',
          max: 'Rate must be less than or equal to 100',
        },
      },
      factory: faker => faker.number.int({ min: 0, max: 100 }),
    },

    type: {
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Type must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['VAT', 'GST', 'Sales Tax', 'Customs Duty']),
    },

    country: {
      order: 4,
      fillable: true,
      validation: {
        rule: schema.string().required().max(100),
        message: {
          max: 'Country must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.location.country(),
    },

    region: {
      order: 5,
      fillable: true,
      validation: {
        rule: schema.enum(['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica']),
      },
      factory: faker => faker.helpers.arrayElement(['North America', 'South America', 'Europe', 'Asia', 'Africa', 'Oceania', 'Antarctica']),
    },

    status: {
      default: 'active',
      order: 6,
      fillable: true,
      validation: {
        rule: schema.enum(['active', 'inactive']),
      },
      factory: faker => faker.helpers.arrayElement(['active', 'inactive']),
    },

    isDefault: {
      default: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => false,
    },

    /**
     * A stable name for this component, for code to reference.
     *
     * `name` is what an operator reads and edits in the dashboard, so it is
     * the wrong thing for an application to branch on — renaming "State sales
     * tax" to "Sales tax (CA)" should not change what gets charged. A code is
     * the identifier that survives the rename.
     *
     * Free-form on purpose. What counts as a component differs by
     * jurisdiction: `vat`, `gst`, `excise`, `city`, `eco-fee`.
     */
    code: {
      order: 8,
      fillable: true,
      default: '',
      validation: {
        rule: schema.string().max(64),
        message: {
          max: 'Code must have a maximum of 64 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['vat', 'gst', 'sales', 'excise', 'city']),
    },

    /**
     * Whether a qualifying exemption removes this component.
     *
     * Most places tax in parts, and an exemption usually lifts some of them
     * and not others: groceries escape VAT but not a deposit levy, and a
     * Californian medical cannabis patient is exempt from sales tax while
     * still paying excise and the city's business tax. Modelling tax as one
     * blended number cannot say that, so an app either over-charges the
     * exempt customer or under-collects tax it owes.
     *
     * What *qualifies* is the application's business — a card, a resale
     * certificate, a charity registration. This only records that the
     * component is the kind that can be lifted.
     */
    exemptible: {
      order: 9,
      fillable: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
      factory: () => false,
    },
  },

  dashboard: {
    highlight: true,
  },
} as const)
