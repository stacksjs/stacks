import { Kysely, MysqlDialect as qbMysqlDialect, sql as qbSql } from 'kysely'
import { createPool as qbCreatePool } from 'mysql2'

export const QueryBuilder = Kysely

export const MysqlDialect = qbMysqlDialect

export const sql = qbSql

export const createPool = qbCreatePool
