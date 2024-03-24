// import { config } from '@stacksjs/config'

// import { dynamodbClient } from './drivers/dynamodb'

// if (config.database.default === 'dynamodb') {
// dynamodbClient.createTable('users', (table) => {
//   table.string('id').primary()
//   table.string('name')
//   table.string('email')
//   table.string('password')
//   table.timestamps()
// })
// }

export * from './generated/User'
export * from './generated/types'

export const rule = {
  string: () => ({
    rule: 'string',
  }),

  boolean: () => ({
    rule: 'boolean',
  }),

  int: () => ({
    rule: 'number',
  }),

  email: () => ({
    rule: 'email',
  }),

  password: () => ({
    rule: 'password',
  }),

  timestamps: () => ({
    rule: 'timestamps',
  }),
}
