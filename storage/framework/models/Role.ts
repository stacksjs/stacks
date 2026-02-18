import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Role',
  table: 'roles',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'roles',
      routes: ['index', 'show'],
    },
  },

  belongsToMany: ['Permission', 'User'],

  attributes: {
    name: {
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          required: 'Role name is required',
          string: 'Role name must be a string',
        },
      },
      factory: (faker: any) => faker.helpers.arrayElement(['admin', 'editor', 'viewer', 'moderator', 'subscriber']),
    },

    guardName: {
      fillable: true,
      validation: {
        rule: schema.string().max(255),
        message: {
          string: 'Guard name must be a string',
        },
      },
      factory: () => 'web',
    },

    description: {
      fillable: true,
      validation: {
        rule: schema.string().max(500).optional(),
        message: {
          string: 'Description must be a string',
        },
      },
      factory: (faker: any) => faker.lorem.sentence(),
    },
  },
} as const)
