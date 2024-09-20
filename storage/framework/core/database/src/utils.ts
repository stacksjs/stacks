import { app, database } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import type { Database } from '@stacksjs/orm'
import { Kysely, MysqlDialect, PostgresDialect, sql } from 'kysely'
import { BunWorkerDialect } from 'kysely-bun-worker'
import { createPool } from 'mysql2'
import { Pool } from 'pg'

const appEnv = app.env || 'local'

export function getDialect() {
  const driver = database.default ?? 'sqlite'

  log.debug(`Using database driver: ${driver}`)

  if (driver === 'sqlite') {
    const defaultName = appEnv !== 'testing' ? 'database/stacks.sqlite' : 'database/stacks_testing.sqlite'
    const path = database.connections?.sqlite.database ?? defaultName

    return new BunWorkerDialect({
      url: '/Users/glennmichaeltorregosa/Documents/Projects/stacks/database/stacks.sqlite',
    })
  }

  if (driver === 'mysql') {
    return new MysqlDialect({
      pool: createPool({
        database: database.connections?.mysql?.name || 'stacks', // Use modified dbName
        host: database.connections?.mysql?.host ?? '127.0.0.1',
        user: database.connections?.mysql?.username ?? 'root',
        password: database.connections?.mysql?.password ?? '',
        port: database.connections?.mysql?.port ?? 3306,
      }),
    })
  }

  if (driver === 'postgres') {
    const pgDbName = database.connections?.postgres?.name ?? 'stacks' // Default Postgres database name
    const finalPgDbName = appEnv === 'testing' ? `${pgDbName}_testing` : pgDbName // Modify if testing

    return new PostgresDialect({
      pool: new Pool({
        database: finalPgDbName, // Use modified pgDbName
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
