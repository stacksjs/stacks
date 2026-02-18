import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'Permission',
  table: 'permissions',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useApi: {
      uri: 'permissions',
      routes: ['index', 'show'],
    },
  },

  belongsToMany: ['Role', 'User'],

  attributes: {
    name: {
      unique: true,
      fillable: true,
      validation: {
        rule: schema.string().required().max(255),
        message: {
          required: 'Permission name is required',
          string: 'Permission name must be a string',
        },
      },
      factory: (faker: any) => faker.helpers.arrayElement(['create-posts', 'edit-posts', 'delete-posts', 'manage-users', 'view-analytics']),
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
