import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Subscriber',
  table: 'subscribers',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['User'],
  hasMany: ['SubscriberEmail', 'EmailListSubscriber', 'CampaignSend'],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useSeeder: {
      count: 10,
    },
    useApi: {
      uri: 'subscribers',
      routes: ['index', 'store', 'show', 'update', 'destroy'],
      // Subscriber rows are PII (email + status + source). Auth-gate
      // every CRUD route. The public signup path is the dedicated
      // `/api/email/subscribe` action — that has its own rate-limited,
      // CSRF-skipped handler that wraps `Subscriber.create()`. Apps
      // that want public destroy (one-click unsubscribe) should use
      // the existing `/api/email/unsubscribe` UUID-token route, not
      // expose `DELETE /api/subscribers/{id}`.
      middleware: ['auth'],
    },
  },

  attributes: {
    email: {
      unique: true,
      required: true,
      fillable: true,
      validation: {
        rule: schema.string().email().max(255),
        message: {
          string: 'email must be a string',
          required: 'email is required',
          email: 'email must be a valid email address',
          max: 'email must have a maximum of 255 characters',
        },
      },
      factory: faker => faker.internet.email(),
    },

    status: {
      required: true,
      fillable: true,
      default: 'subscribed',
      validation: {
        rule: schema.enum(['subscribed', 'unsubscribed', 'pending', 'bounced']),
        message: {
          enum: 'status must be one of: subscribed, unsubscribed, pending, bounced',
        },
      },
      factory: faker => faker.helpers.arrayElement(['subscribed', 'subscribed', 'subscribed', 'unsubscribed', 'pending']),
    },

    source: {
      required: false,
      fillable: true,
      default: 'homepage',
      validation: {
        rule: schema.string().max(100),
        message: {
          string: 'source must be a string',
          max: 'source must have a maximum of 100 characters',
        },
      },
      factory: faker => faker.helpers.arrayElement(['homepage', 'blog', 'landing-page', 'api', 'import']),
    },

    // Set when the subscriber globally unsubscribes via the legacy
    // /api/email/unsubscribe?token=<uuid> route. Per-list unsubscribe
    // state (the modern flow) lives on `email_list_subscribers` so a
    // user can drop "Weekly Digest" without losing transactional mail.
    unsubscribedAt: {
      required: false,
      fillable: true,
      validation: {
        rule: schema.timestamp(),
      },
      factory: () => null,
    },
  },
} as const)
