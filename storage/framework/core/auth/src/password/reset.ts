import type { CustomerJsonResponse } from '@stacksjs/orm'
import { db } from '@stacksjs/database'

/**
 * Fetch a customer by ID
 */
export async function fetchById(passwordReset: PasswordRes): Promise<PasswordResetJsonResponse | undefined> {
    const passwordResetdata = {

    }

    const result = await db
    .insertInto('password_resets')
    .values(passwordResetdata)
    .returningAll()
    .executeTakeFirst()

    return result
}