import { defineModel } from '@stacksjs/orm'

export default defineModel({
  name: 'SampleModel',
  table: 'sample_models',

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
