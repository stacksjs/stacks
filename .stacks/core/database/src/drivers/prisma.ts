import Prisma from '@prisma/client'
const { PrismaClient } = Prisma

/**
 * **Database Client**
 *
 * The database client is a wrapper around your database of choice.
 *
 * @example
 * ```ts
 * import { client } from '@stacks/database'
 *
 * const db = new client()
 *
 * // fetch users
 * const users = await db.user.findMany()
 * ```
 * @see https://docs.stacksjs.dev/database
 */
const client = PrismaClient

export { client }
