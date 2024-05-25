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

export * from './utils'
export * from './generated/types'
