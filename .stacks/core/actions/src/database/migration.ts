import { generateMigrationFile } from '@stacksjs/database'

generateMigrationFile({
  name: 'CreateUsersTable',
  up: `
    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `,
  down: `
    DROP TABLE users;
  `,
})
