import type { Database } from '@stacksjs/database'
import { sql } from '@stacksjs/database'

export async function up(db: Database<any>) {
await sql`
        ALTER TABLE users
        MODIFY COLUMN password VARCHAR(255) NOT NULL AFTER name;
      `.execute(db)

await sql`
        ALTER TABLE users
        MODIFY COLUMN email VARCHAR(255) NOT NULL AFTER password;
      `.execute(db)

await sql`
        ALTER TABLE users
        MODIFY COLUMN job_title VARCHAR(255) NOT NULL AFTER email;
      `.execute(db)

}
