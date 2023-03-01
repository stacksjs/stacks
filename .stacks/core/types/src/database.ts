import type { PrismaClient } from '@prisma/client'
import type { Model } from './model'

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
  migrate: (models: Model, path: string, options?: SchemaOptions) => Promise<void>
  seed: (modelName: string, data: SeedData) => Promise<void>
  factory: (modelName: string, fileName: string, path: string) => Promise<void>
}
