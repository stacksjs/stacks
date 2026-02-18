import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Notification',
  table: 'notifications',
  primaryKey: 'id',
  autoIncrement: true,

  belongsTo: ['User'],

  traits: {
    useTimestamps: true,
  },

  attributes: {
    type: {
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          required: 'type is required',
          string: 'type must be a string',
          max: 'type must have a maximum of 255 characters',
        },
      },
      factory: () => 'App\\Notifications\\ExampleNotification',
    },

    data: {
      fillable: true,
      validation: {
        rule: schema.string().required(),
        message: {
          required: 'data is required',
          string: 'data must be a string',
        },
      },
      factory: (faker: any) => JSON.stringify({ message: faker.lorem.sentence() }),
    },

    readAt: {
      fillable: true,
      validation: {
        rule: schema.timestamp(),
        message: {
          timestamp: 'readAt must be a valid timestamp',
        },
      },
      factory: () => null,
    },
  },
} as const)
