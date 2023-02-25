import type { PrismaClient } from '@prisma/client'

export interface ColumnOptions {
  name: string
  type: string
  required?: boolean
  unique?: boolean
  default?: string
}

export interface ModelOptions {
  name: string
  columns: ColumnOptions[]
}

export type DatabaseClient = PrismaClient

export interface DatabaseOptions {
  client: DatabaseClient
}

export interface SeedData {
  [key: string]: any
}

export interface SchemaOptions {
  database: string
}

export interface DatabaseDriver {
  client: DatabaseClient
  migrate: (models: ModelOptions, path: string, options?: SchemaOptions) => Promise<void>
  seed: (modelName: string, data: SeedData) => Promise<void>
  factory: (modelName: string, fileName: string, path: string) => Promise<void>
}
