import { PrismaClient } from '@prisma/client'

/**
 * ##  Stacks Database Client
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```ts
 * const database = new client()
 * // Fetch zero or more Users
 * const users = await database.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://docs.stacksjs.dev/database).
 */
const client = PrismaClient

export { client }
