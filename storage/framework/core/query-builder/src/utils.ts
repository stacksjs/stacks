import { Kysely, MysqlDialect, PostgresDialect } from 'kysely'
import { BunWorkerDialect } from 'kysely-bun-worker'
import { Pool } from 'pg'
import { createPool } from 'mysql2'
import type { Database } from '@stacksjs/orm'
import { database } from '@stacksjs/config'

export function getDialect() {
  const driver = database.default ?? 'sqlite'

  if (driver === 'sqlite') {
    return new BunWorkerDialect({
      url: database.connections?.sqlite.database ?? 'stacks.sqlite',
    })
  }

  if (driver === 'mysql') {
    return new MysqlDialect({
      pool: createPool({
        database: database.connections?.mysql?.name ?? 'stacks',
        host: database.connections?.mysql?.host ?? '127.0.0.1',
        user: database.connections?.mysql?.username ?? 'root',
        password: database.connections?.mysql?.password ?? '',
        port: database.connections?.mysql?.port ?? 3306,
      }),
    })
  }

  if (driver === 'postgres') {
    return new PostgresDialect({
      pool: new Pool({
        database: database.connections?.postgres?.name ?? 'stacks',
        host: database.connections?.postgres?.host ?? '127.0.0.1',
        user: database.connections?.postgres?.username ?? 'root',
        password: database.connections?.postgres?.password ?? '',
        port: database.connections?.postgres?.port ?? 5432,
      }),
    })
  }

  throw new Error(`Unsupported driver: ${driver}`)
}

export const db = new Kysely<Database>({
  dialect: getDialect(),
})
