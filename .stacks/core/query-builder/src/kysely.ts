import { Kysely, MysqlDialect as qbMysqlDialect, PostgresDialect as qbPostgresql, sql as qbSql } from 'kysely'
import { createPool } from 'mysql2'
import { Pool } from 'pg'
import { Cursor as qbCursor } from 'pg-cursor'

interface MysqlConfig {
  driver?: string
  url?: string
  host?: string
  port?: number
  database?: string
  user?: string
  password?: string
}

interface PostgresqlConfig {
  host?: string
  database?: string
}
export const Cursor = qbCursor

export const sql = qbSql

export const QueryBuilder = Kysely

export const MysqlDialect = qbMysqlDialect

export const PostgresDialect = qbPostgresql

export function createPostgresPool(config: PostgresqlConfig) {
  return Pool(config)
}

export function createMysqlPool(config: MysqlConfig) {
  return createPool(config)
}
