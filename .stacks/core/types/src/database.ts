import type { PrismaClient } from '@prisma/client'

export type DatabaseClient = PrismaClient

export interface DatabaseOptions {
  client: DatabaseClient
}

export interface FactoryOptions {
  name: string;
  count?: number;
  items: object;
  columns: object;
}
