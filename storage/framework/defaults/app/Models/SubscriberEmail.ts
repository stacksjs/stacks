import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'SubscriberEmail',
  table: 'subscriber_emails',
  primaryKey: 'id',
  autoIncrement: true,
  belongsTo: ['Subscriber'],

  traits: {
    useUuid: true,
    useTimestamps: true,
    useApi: {
      uri: 'subscriber-emails',
      routes: ['index', 'show'],
    },
  },

  attributes: {
    email: {
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
  },
} as const)
