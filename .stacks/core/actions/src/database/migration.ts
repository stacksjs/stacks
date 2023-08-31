// import { generateMigrationFile } from '@stacksjs/database'
import { projectPath } from "@stacksjs/path"
import User from '../../../../../app/models/User'

// generateMigrationFile({
//   name: 'CreateUsersTable',
//   up: `
//     CREATE TABLE users (
//       id SERIAL PRIMARY KEY,
//       email VARCHAR(255) NOT NULL,
//       password VARCHAR(255) NOT NULL,
//       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
//       updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
//     );
//   `,
//   down: `
//     DROP TABLE users;
//   `,
// })

const fields = User.fields

const file = Bun.file("user-migration.ts");
const writer = file.writer();

writer.write("import { Kysely, sql } from 'kysely'\n");
writer.write("import { db } from '@stacksjs/database'\n");
writer.write(" \n");
writer.write("export async function up(db: Kysely<any>): Promise<void> { \n");

writer.write("  await db.schema \n");
writer.write(`  .createTable('${User.table}') \n`);

writer.write(".addColumn('created_at', 'timestamp', (col) => col.defaultTo(sql`now()`).notNull()) \n")

writer.end();

// // Rules
// if (fields)
//   console.log(Object.keys(fields))

//   const regex = /rule:.*$/gm;
//   let match;
  
//   while ((match = regex.exec(code)) !== null) {
//     console.log(match[0]); // Outputs: 'rule: validate.string().minLength(3).maxLength(255).nullable()', etc.
//   }
