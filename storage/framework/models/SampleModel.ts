import { defineModel } from '@stacksjs/orm'

export default defineModel({
  name: 'SampleModel',

  traits: {
    useTimestamps: true,

    useSeeder: {
      count: 10,
    },
  },

  attributes: {
    // your attributes here
  },
} as const)
