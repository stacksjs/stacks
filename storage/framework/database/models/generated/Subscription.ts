import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'

export default {
  name: 'Subscription', // defaults to the sanitized file name
  table: 'subscriptions', // defaults to the lowercase, plural name of the model name (or the name of the model file)
  primaryKey: 'id', // defaults to `id`
  autoIncrement: true, // defaults to true

  attributes: {
    user_id: {
      required: true,
      fillable: true,
    },

    type: {
      required: true,
      fillable: true,
      factory: () => faker.helpers.arrayElement(['basic', 'premium', 'enterprise']),
    },

    stripe_id: {
      required: true,
      unique: true,
      fillable: true,
      factory: () => faker.string.alphanumeric,
    },

    stripe_status: {
      required: true,
      fillable: true,
      factory: () => faker.helpers.arrayElement(['active', 'canceled', 'past_due']),
    },

    stripe_price: {
      fillable: true,
      factory: () => faker.commerce.price(),
    },

    quantity: {
      fillable: true,
      factory: () => faker.number.int,
    },

    trial_ends_at: {
      fillable: true,
      factory: () => faker.date.future(),
    },

    ends_at: {
      fillable: true,
      factory: () => faker.date.future(),
    },

    last_used_at: {
      fillable: true,
      factory: () => faker.date.recent(),
    },
  },
} satisfies Model
