import { Schema } from '@stacksjs/database'

await Schema.createTable('users', (table) => {
  table.increments('id')
  table.string('name')
  table.string('email').notNullable()
  table.string('password').notNullable()
  table.timestamps()
})
