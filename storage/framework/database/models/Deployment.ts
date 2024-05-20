import { collect } from '@stacksjs/collections'
import { faker } from '@stacksjs/faker'
import { schema } from '@stacksjs/validation'
import type { Model } from '@stacksjs/types'

export default {
  name: 'Deployment',
  table: 'deployments',
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

    executionTime: { // in nanoseconds
      validator: {
        rule: schema.number(),
        message: '`execution_time` must be a number',
      },

      factory: () => faker.number.int(),
    },

    deployScript: {
      validator: {
        rule: schema.string(),
        message: '`deploy_script` must be a string',
      },

      factory: () => faker.lorem.sentence(),
    },

    terminalOutput: {
      validator: {
        rule: schema.string(),
        message: '`terminal_output` must be a string',
      },

      factory: () => faker.lorem.sentence(),
    },
  },
} satisfies Model
