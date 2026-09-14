import process from 'node:process'
import { ensureDatabaseConfigLoaded, migrateAuthTables } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

log.info('Setting up authentication...')

try {
  await ensureDatabaseConfigLoaded()
  // Share schema creation and legacy-column upgrades with buddy migrate.
  // A second schema copy drifts from the columns token issuance needs.
  const result = await migrateAuthTables({ verbose: true })
  if (!result.success)
    throw new Error(result.error || 'Authentication tables could not be initialized')
}
catch (error) {
  await log.error('Authentication setup failed', error)
  process.exit(1)
}

console.log('\n✓ Authentication setup complete!')
console.log('\nFeatures enabled:')
console.log('  - Token hashing (SHA-256) for secure storage')
console.log('  - Refresh tokens for seamless token renewal')
console.log('  - Scope-based authorization')
console.log('  - Password reset flow')
console.log('\nNext steps:')
console.log('  1. Use createToken(userId, name, scopes) to generate tokens')
console.log('  2. Use refreshToken(token) to exchange refresh tokens')
console.log('  3. Use the "auth" middleware to protect routes')
console.log('  4. Use tokenCan(scope) for authorization checks')
console.log('  5. POST /password/forgot to request password reset')
console.log('  6. POST /password/reset to reset password with token\n')

process.exit(0)
