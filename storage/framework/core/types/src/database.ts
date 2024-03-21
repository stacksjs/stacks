export interface DatabaseOptions {
  default: string

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
