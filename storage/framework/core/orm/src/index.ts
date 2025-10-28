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

export * from '../../../orm/src'
export * from '../../../orm/src/types'
export * from './db'
export * from './generated'
export * from './requests'
export * from './subquery'
export * from './transaction'
export * from './utils'
