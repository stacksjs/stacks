import { type Model } from './model'

export type DatabaseClient = any

export interface DatabaseOptions {
  default: string

  /**
   * The name of the database to use.
   * @default stacks
   */
  name: string

  connections: {
    mysql: {
      url?: string
      host?: string
      port?: number
      client?: DatabaseClient
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

    planetscale: object
    postgres: object
  }

  migrations: string
}

export type DatabaseConfig = DatabaseOptions

export interface FactoryOptions {
  name: string
  count?: number
  items: object
  columns: object
}

export interface SchemaOptions {
  database: string
}

export interface DatabaseDriver {
  client: DatabaseClient
  migrate: (models: Model[], path: string, options?: SchemaOptions) => Promise<void>
  // seed: (modelName: string, data: SeedData) => Promise<void>
  factory: (modelName: string, fileName: string, path: string) => Promise<void>
}
