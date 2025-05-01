export interface DatabaseOptions {
  default: string
  logging?: boolean
  connections: {
    mysql?: {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
    }

    sqlite: {
      url?: string
      database?: string
      prefix?: string
    }

    dynamodb?: {
      key?: string
      secret?: string
      region?: string
      prefix?: string
      endpoint?: string
    }

    postgres?: {
      url?: string
      host?: string
      port?: number
      name?: string
      username?: string
      password?: string
      prefix?: string
    }
  }

  migrations: string
  migrationLocks: string

  // Query logging configuration
  queryLogging?: {
    enabled: boolean
    slowThreshold: number // in milliseconds
    retention: number // in days
    pruneFrequency: number // in hours
    excludedQueries?: string[] // patterns to exclude
    analysis?: {
      enabled: boolean
      analyzeAll: boolean // analyze all queries, not just slow ones
      explainPlan: boolean // collect EXPLAIN plans
      suggestions: boolean // generate optimization suggestions
    }
  }
}

export type DatabaseConfig = Partial<DatabaseOptions>

export interface FactoryOptions {
  name: string
  count?: number
  items: object
  columns: object
}

export interface SchemaOptions {
  database: string
}
