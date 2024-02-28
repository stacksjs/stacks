import { sql } from 'kysely'

export const now = sql`now()`
