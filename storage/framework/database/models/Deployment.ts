import { collect } from '@stacksjs/collections'
import { faker } from '@stacksjs/faker'
import type { Model } from '@stacksjs/types'
import { schema } from '@stacksjs/validation'

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

      validation: {
        rule: schema.string().maxLength(512),
        message: {
          string: 'commit_sha must be a string',
          required: 'commit_sha is required',
          maxLength: 'commit_sha must have a maximum of 512 characters',
        },
      },

      factory: () => faker.git.commitSha(),
    },

    commitMessage: {
      validation: {
        rule: schema.string(),
        message: {
          string: 'commit_message must be a string',
          required: 'commit_message is required',
        },
      },

      factory: () => faker.git.commitMessage(),
    },

    branch: {
      validation: {
        rule: schema.string(),
        message: {
          string: 'branch must be a string',
          required: 'branch is required',
        },
      },

      factory: () => faker.git.branch(),
    },

    status: {
      validation: {
        rule: schema.string(),
        message: {
          string: 'status must be a string',
          required: 'status is required',
        },
      },

      factory: () => collect(['pending', 'success', 'failure']).random(),
    },

    executionTime: {
      // in nanoseconds
      validation: {
        rule: schema.number(),
        message: {
          number: 'execution_time must be a number',
          required: 'execution_time is required',
        },
      },

      factory: () => faker.number.int({ max: 100 }),
    },

    deployScript: {
      validation: {
        rule: schema.string(),
        message: {
          string: 'deploy_script must be a string',
          required: 'deploy_script is required',
        },
      },

      factory: () => faker.lorem.sentence(),
    },

    terminalOutput: {
      validation: {
        rule: schema.string(),
        message: {
          string: 'terminal_output must be a string',
          required: 'terminal_output is required',
        },
      },

      factory: () => faker.lorem.sentence(),
    },
  },
} satisfies Model
