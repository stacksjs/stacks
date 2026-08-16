import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * One field of a Form. `name` is the machine key submissions store values
 * under; `conditions` is a show/hide rule set evaluated client-side for UX
 * and re-evaluated server-side for correctness (a hidden required field is
 * not required, and values for hidden fields are discarded).
 */
export default defineModel({
  name: 'FormField',
  table: 'form_fields',
  primaryKey: 'id',
  autoIncrement: true,

  indexes: [
    {
      name: 'form_fields_form_name_unique',
      columns: ['form_id', 'name'],
      unique: true,
    },
  ],

  traits: {
    useTimestamps: true,
    useApi: {
      middleware: ['auth'],
      uri: 'form-fields',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
    },
  },

  belongsTo: ['Form'],

  attributes: {
    name: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.string().min(1).max(64).matches(/^[a-z0-9_]+$/),
      },
      factory: faker => faker.lorem.word(),
    },

    label: {
      required: true,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().min(1).max(255),
      },
      factory: faker => faker.lorem.words(2),
    },

    type: {
      required: true,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.enum(['text', 'textarea', 'email', 'phone', 'select', 'checkbox', 'radio', 'date', 'file', 'currency', 'section_break'] as const),
      },
      factory: faker => faker.helpers.arrayElement(['text', 'email', 'select']),
    },

    required: {
      required: false,
      order: 4,
      fillable: true,
      default: false,
      validation: {
        rule: schema.boolean(),
      },
      factory: faker => faker.datatype.boolean(),
    },

    position: {
      required: false,
      order: 5,
      fillable: true,
      default: 0,
      validation: {
        rule: schema.number().min(0),
      },
      factory: faker => faker.number.int({ min: 0, max: 20 }),
    },

    width: {
      required: false,
      order: 6,
      fillable: true,
      default: 'full',
      validation: {
        rule: schema.enum(['full', 'half'] as const),
      },
      factory: () => 'full',
    },

    /**
     * Per-type options JSON: { placeholder?, choices?: {label,value}[],
     * min?, max?, accept?: string[], maxSizeMb?, amountCents? }
     */
    options: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.json(),
      },
      factory: () => JSON.stringify({}),
    },

    /**
     * Visibility rules JSON: { action: 'show'|'hide', logic: 'all'|'any',
     * rules: [{ field, op, value? }] }
     */
    conditions: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.json(),
      },
      factory: () => null,
    },
  },
} as const)
