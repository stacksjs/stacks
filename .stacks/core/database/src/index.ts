// export * from './migrations'
// export * from './seeder''
import { Kysely, MysqlDialect } from 'kysely'
import { createPool } from 'mysql2'
import { BunWorkerDialect } from './kysely-bun-worker'

// const driver = config.database.default
const driver = 'mysql'

// const dbName = config.database.name

export interface DatabaseType {
  user: any
}

let dialect

if (driver === 'sqlite') {
  dialect = new BunWorkerDialect({
    url: 'stacks.sqlite',
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
    }),
  })
}

export const QueryBuilder = new Kysely<DatabaseType>({
  dialect,
})

export const dbDialect = dialect
