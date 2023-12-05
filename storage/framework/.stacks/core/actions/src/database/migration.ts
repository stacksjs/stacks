// import { generateMigrationFile } from 'stacks:database'
// import { config } from 'stacks:config'

// const driver = config.database.default
const driver = 'sqlite'

if (driver === 'sqlite')
  await import('./migration-sqlite.ts')
else
  await import('./migration-mysql.ts')
