import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
await sql`
        ALTER TABLE users
        MODIFY COLUMN name VARCHAR(88)
      `.execute(db)

}
