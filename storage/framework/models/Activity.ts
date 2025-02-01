import type { Model } from '@stacksjs/types'
import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'

export default {
  name: 'Activity',
  table: 'activities',
  primaryKey: 'id',
  autoIncrement: true,

  traits: {
    useTimestamps: true,
    useSoftDeletes: true,
    useSeeder: {
      count: 10,
    },
    useApi: true,
    likeable: {
      table: 'likes',
      foreignKey: 'activity_id',
    },
  },

  attributes: {
    title: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'title must be a string',
          required: 'title is required',
        },
      },

      factory: () => faker.lorem.sentence({ min: 3, max: 6 }),
    },

    description: {
      fillable: true,
      validation: {
        rule: schema.string().nullable(),
        message: {
          string: 'description must be a string',
        },
      },

      factory: () => faker.lorem.sentence({ min: 10, max: 25 }),
    },

    address: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'address must be a string',
          required: 'address is required',
        },
      },

      factory: () => faker.location.streetAddress(),
    },

    latlng: {
      fillable: true,
      validation: {
        rule: schema.string(),
        message: {
          string: 'latlng must be of format "latitude, longitude"',
          required: 'latlng is required',
        },
      },

      factory: () => `${faker.location.latitude()}, ${faker.location.longitude()}`,
    },

    infoSource: {
      fillable: true,
      validation: {
        rule: schema.enum(['news', 'social-media', 'friends', 'family']),
        message: {
          string: 'infoSource must be either news, social-media, friends or family',
          required: 'infoSource is required',
        },
      },

      factory: () => faker.internet.url(),
    },

    wereDetained: {
      fillable: true,
      validation: {
        rule: schema.boolean().nullable(),
        message: {
          string: 'wereDetained must be a boolean or null',
        },
      },

      factory: () => faker.datatype.boolean(),
    },
  },
} satisfies Model
