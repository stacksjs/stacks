// export * from './migrations'
// export * from './seeder''

import { Kysely, MysqlDialect, SqliteDialect } from 'kysely'
import { createPool } from 'mysql2'
import { Database } from "bun:sqlite"

const driver = 'sqlite'

export interface DatabaseType {
  user: any
}

const sqdb = new Database("mydb.sqlite", { create: true })

let dialect

if (driver === 'sqlite') {
  dialect = new SqliteDialect({
    database: sqdb,
  })
}
else {
  dialect = new MysqlDialect({
    pool: createPool({
      database: 'stacks',
      host: '127.0.0.1',
      user: 'root',
      password: '',
      port: 3306,
      connectionLimit: 10,
    }),
  })
}

console.log(dialect)

export const db = new Kysely<Database>({
  dialect,
})
