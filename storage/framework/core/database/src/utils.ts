import type { Database } from '@stacksjs/orm'
import type { RawBuilder } from 'kysely'
// Import config directly, but gracefully handle potential issues
import * as config from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { projectPath } from '@stacksjs/path'
import { Kysely, MysqlDialect, PostgresDialect, sql } from 'kysely'
import { BunWorkerDialect } from 'kysely-bun-worker'
import { createPool } from 'mysql2'

import { Pool } from 'pg'

// Simple functions with defensive defaults in case the imports failed
function getEnv(): string {
  return config?.app?.env || 'local'
}

function getDriver(): string {
  return config?.database?.default || 'sqlite'
}

function getDatabaseConfig() {
  return config?.database || { connections: {} }
}

export function getDialect(): MysqlDialect | PostgresDialect | BunWorkerDialect {
  const appEnv = getEnv()
  const driver = getDriver()
  const database = getDatabaseConfig()

  log.debug(`Using database driver: ${driver}`)

  if (driver === 'sqlite') {
    const defaultName = appEnv !== 'testing' ? 'database/stacks.sqlite' : 'database/stacks_testing.sqlite'
    const sqliteDbName = database.connections?.sqlite?.database ?? defaultName
    const dbPath = projectPath(sqliteDbName)

    return new BunWorkerDialect({
      url: dbPath,
    })
  }

  if (driver === 'mysql') {
    return new MysqlDialect({
      pool: createPool({
        database: database.connections?.mysql?.name || 'stacks',
        host: database.connections?.mysql?.host ?? '127.0.0.1',
        user: database.connections?.mysql?.username ?? 'root',
        password: database.connections?.mysql?.password ?? '',
        port: database.connections?.mysql?.port ?? 3306,
      }),
    })
  }

  if (driver === 'postgres') {
    const pgDbName = database.connections?.postgres?.name ?? 'stacks'
    const finalPgDbName = appEnv === 'testing' ? `${pgDbName}_testing` : pgDbName

    return new PostgresDialect({
      pool: new Pool({
        database: finalPgDbName,
        host: database.connections?.postgres?.host ?? '127.0.0.1',
        user: database.connections?.postgres?.username ?? '',
        password: database.connections?.postgres?.password ?? '',
        port: database.connections?.postgres?.port ?? 5432,
      }),
    })
  }

  throw new Error(`Unsupported driver: ${driver}`)
}

export const now: RawBuilder<any> = sql`now()`

export const db: Kysely<Database> = new Kysely<Database>({
  dialect: getDialect(),
})
