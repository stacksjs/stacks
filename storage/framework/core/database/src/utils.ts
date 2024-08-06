import { database } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import type { Database } from '@stacksjs/orm'
import { plural, snakeCase } from '@stacksjs/strings'
import type { Model } from '@stacksjs/types'
import { Kysely, MysqlDialect, PostgresDialect, sql } from 'kysely'
import { BunWorkerDialect } from 'kysely-bun-worker'
import { createPool } from 'mysql2'
import { Pool } from 'pg'

export function getDialect() {
  const driver = database.default ?? 'sqlite'

  log.debug(`Using database driver: ${driver}`)

  if (driver === 'sqlite') {
    const path = database.connections?.sqlite.database ?? 'database/stacks.sqlite'
    return new BunWorkerDialect({
      url: path,
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
        user: database.connections?.postgres?.username ?? '',
        password: database.connections?.postgres?.password ?? '',
        port: database.connections?.postgres?.port ?? 5432,
      }),
    })
  }

  throw new Error(`Unsupported driver: ${driver}`)
}

export const now = sql`now()`

export const db = new Kysely<Database>({
  dialect: getDialect(),
})
