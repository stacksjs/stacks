import type { QueryBuilderConfig } from 'bun-query-builder'

const config: QueryBuilderConfig = {
  verbose: true,
  dialect: 'sqlite',
  database: {
    database: 'database/stacks.sqlite',
  },
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    defaultOrderColumn: 'created_at',
  },
  pagination: {
    defaultPerPage: 25,
    cursorColumn: 'id',
  },
  softDeletes: {
    enabled: false,
    column: 'deleted_at',
    defaultFilter: true,
  },
}

export default config
