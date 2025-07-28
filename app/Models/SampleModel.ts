import type { Model } from '@stacksjs/types'

export default {
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
} satisfies Model
