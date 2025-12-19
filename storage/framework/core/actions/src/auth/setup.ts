import process from 'node:process'
import { randomBytes } from 'node:crypto'
import { db } from '@stacksjs/database'
import { log } from '@stacksjs/logging'

log.info('Setting up authentication...')

// Step 1: Ensure OAuth tables exist
log.info('Ensuring OAuth tables exist...')

try {
  // Create oauth_clients table if it doesn't exist
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(255) NOT NULL,
      secret VARCHAR(100),
      provider VARCHAR(255),
      redirect VARCHAR(2000) NOT NULL,
      personal_access_client BOOLEAN NOT NULL DEFAULT 0,
      password_client BOOLEAN NOT NULL DEFAULT 0,
      revoked BOOLEAN NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP
    )
  `).execute()

  // Create oauth_access_tokens table if it doesn't exist
  await db.unsafe(`
    CREATE TABLE IF NOT EXISTS oauth_access_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      oauth_client_id INTEGER NOT NULL,
      token VARCHAR(512) NOT NULL,
      name VARCHAR(255),
      scopes VARCHAR(2000),
      revoked BOOLEAN NOT NULL DEFAULT 0,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (oauth_client_id) REFERENCES oauth_clients(id)
    )
  `).execute()

  log.success('OAuth tables ready')
}
catch (error) {
  log.error('Failed to create OAuth tables', error)
  process.exit(1)
}

// Step 2: Create personal access client
log.info('Creating personal access client...')

try {
  // Check if personal access client already exists using raw SQL
  const existing = await db.unsafe(`
    SELECT id FROM oauth_clients WHERE personal_access_client = 1 LIMIT 1
  `).execute()

  if ((existing as any[])?.length > 0) {
    console.log('\n✓ Personal access client already exists')
  }
  else {
    const secret = randomBytes(40).toString('hex')

    await db.unsafe(`
      INSERT INTO oauth_clients (name, secret, provider, redirect, personal_access_client, password_client, revoked, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `, ['Personal Access Client', secret, 'local', 'http://localhost', 1, 0, 0]).execute()

    console.log('\n✓ Personal access client created successfully')
  }
}
catch (error) {
  console.error('Failed to create personal access client:', error)
  process.exit(1)
}

console.log('\n✓ Authentication setup complete!')
console.log('\nNext steps:')
console.log('  1. Use Auth.login() to authenticate users and generate tokens')
console.log('  2. Use the "auth" middleware to protect routes')
console.log('  3. Use the "abilities" middleware for scope-based authorization\n')

process.exit(0)
