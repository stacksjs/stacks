// import { generateMigrationFile } from '@stacksjs/database'
// import { config } from '@stacksjs/config'

// const driver = config.database.default
const driver = 'sqlite'

if (driver === 'sqlite')
  await import('./migration-sqlite.ts')
else
  await import('./migration-mysql.ts')
