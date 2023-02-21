import type { PrismaClient } from '@prisma/client'

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
