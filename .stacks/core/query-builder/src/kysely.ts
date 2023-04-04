import { Kysely, MysqlDialect as qbMysqlDialect, sql as qbSql } from 'kysely'

export const QueryBuilder = Kysely

export const MysqlDialect = qbMysqlDialect

export const sql = qbSql
