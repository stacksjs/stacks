import { collect } from '@stacksjs/collections'
import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'
import type { Model } from '@stacksjs/types'

export default {
  name: 'Deployment',

  traits: {
    useTimestamps: true,

    useSeeder: {
      // defaults to a count of 10,
      count: 100,
    },

    useUuid: true,
  },

  belongsTo: ['User'],

  attributes: {
    commitSha: {
      unique: true,

      validator: {
        rule: schema.string(),
        message: '`commit_sha` must be a string',
      },

      factory: () => faker.git.commitSha(),
    },

    commitMessage: {
      validator: {
        rule: schema.string(),
        message: '`commit_message` must be a string',
      },

      factory: () => faker.git.commitMessage(),
    },

    branch: {
      validator: {
        rule: schema.string(),
        message: '`branch` must be a string',
      },

      factory: () => faker.git.branch(),
    },

    status: {
      validator: {
        rule: schema.string(),
        message: '`status` must be a string',
      },

      factory: () => collect(['pending', 'success', 'failure']).random(),
    },
  },
} satisfies Model
