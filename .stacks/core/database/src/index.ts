// export * from './migrations'
// export * from './seeder''

import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'
import type { Database } from 'bun:sqlite'

const dialect = new MysqlDialect({
  pool: createPool({
    database: 'stacks',
    host: '127.0.0.1',
    user: 'root',
    password: '',
    port: 3306,
    connectionLimit: 10,
  }),
})

export const db = new Kysely<Database>({
  dialect,
})
