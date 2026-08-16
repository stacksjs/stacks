import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

/**
 * One submission of a Form. `values` is the validated field map; `email` and
 * `name` are extracted into typed columns at submit time (from the fields the
 * form's settings name, defaulting to the first email field) so lookups,
 * dedupe and confirmation addressing never need JSON extraction SQL.
 *
 * No `useApi`: public writes and admin reads both go through the
 * `@stacksjs/forms` routes, which own spam guards, payment states and
 * site scoping.
 */
export default defineModel({
  name: 'FormSubmission',
  table: 'form_submissions',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useUuid: true,
    useTimestamps: true,
  },

  belongsTo: ['Form', 'Site'],

  attributes: {
    /** Validated { [fieldName]: value } JSON. Named data, not values - values is a SQL keyword. */
    data: {
      required: true,
      order: 1,
      fillable: true,
      validation: {
        rule: schema.json(),
      },
      factory: () => JSON.stringify({}),
    },

    email: {
      required: false,
      order: 2,
      fillable: true,
      validation: {
        rule: schema.string().email().max(255),
      },
      factory: faker => faker.internet.email(),
    },

    name: {
      required: false,
      order: 3,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: faker => faker.person.fullName(),
    },

    status: {
      required: false,
      order: 4,
      fillable: true,
      default: 'complete',
      validation: {
        rule: schema.enum(['pending_payment', 'complete', 'spam'] as const),
      },
      factory: () => 'complete',
    },

    /** Server-computed. Never trusted from the client. */
    amountCents: {
      required: false,
      order: 5,
      fillable: true,
      validation: {
        rule: schema.number().min(0),
      },
      factory: () => null,
    },

    paymentIntentId: {
      required: false,
      order: 6,
      fillable: true,
      validation: {
        rule: schema.string().max(255),
      },
      factory: () => null,
    },

    ip: {
      required: false,
      order: 7,
      fillable: true,
      validation: {
        rule: schema.string().max(64),
      },
      factory: () => null,
    },

    submittedAt: {
      required: false,
      order: 8,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: (faker) => {
        const date = faker.date.recent()
        return date.toISOString().slice(0, 19).replace('T', ' ')
      },
    },
  },
} as const)
