/**
 * End-to-End tests with hardcoded keys
 * These tests verify the complete encryption/decryption workflow
 */

import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decryptEnv, encryptEnv, getEnv, setEnv } from '../src/cli'
import { decryptValue, encryptValue, generateKeypair } from '../src/crypto'

// Generate test keys for E2E tests
const TEST_KEYS = generateKeypair()

// Test directory
const TEST_DIR = join(process.cwd(), '.test-env-e2e')

function setupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
  mkdirSync(TEST_DIR, { recursive: true })
}

function cleanupTestDir() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

describe('E2E - Encrypt/Decrypt Value', () => {
  it('should encrypt and decrypt a simple value with hardcoded keys', () => {
    const originalValue = 'my-super-secret-password'

    const encrypted = encryptValue(originalValue, TEST_KEYS.publicKey)

    expect(encrypted).toStartWith('encrypted:')
    expect(encrypted).not.toContain(originalValue)

    const decrypted = decryptValue(encrypted, TEST_KEYS.privateKey)

    expect(decrypted).toBe(originalValue)
  })

  it('should encrypt and decrypt database connection string', () => {
    const connectionString = 'postgresql://admin:p@ssw0rd123@localhost:5432/mydb?ssl=true'

    const encrypted = encryptValue(connectionString, TEST_KEYS.publicKey)
    const decrypted = decryptValue(encrypted, TEST_KEYS.privateKey)

    expect(decrypted).toBe(connectionString)
  })

  it('should encrypt and decrypt API keys', () => {
    const apiKeys = [
      'sk_test_51234567890abcdef',
      'pk_live_AaBbCcDdEeFfGgHhIi',
      'AKIAIOSFODNN7EXAMPLE',
    ]

    for (const apiKey of apiKeys) {
      const encrypted = encryptValue(apiKey, TEST_KEYS.publicKey)
      const decrypted = decryptValue(encrypted, TEST_KEYS.privateKey)
      expect(decrypted).toBe(apiKey)
    }
  })

  it('should encrypt and decrypt multi-line values', () => {
    const multiline = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7VJTUt9Us8cKj
MzEfYyjiWA4R4/M2bS1+fWIcPm15j7aXPpGwuY8C7h5p5Kcb9kZLbD8d2L2B1B2
-----END PRIVATE KEY-----`

    const encrypted = encryptValue(multiline, TEST_KEYS.publicKey)
    const decrypted = decryptValue(encrypted, TEST_KEYS.privateKey)

    expect(decrypted).toBe(multiline)
  })

  it('should encrypt and decrypt JSON configuration', () => {
    const jsonConfig = JSON.stringify({
      database: {
        host: 'localhost',
        port: 5432,
        credentials: {
          username: 'admin',
          password: 'secret123',
        },
      },
      features: {
        enableX: true,
        enableY: false,
      },
    })

    const encrypted = encryptValue(jsonConfig, TEST_KEYS.publicKey)
    const decrypted = decryptValue(encrypted, TEST_KEYS.privateKey)

    expect(decrypted).toBe(jsonConfig)
    expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonConfig))
  })

  it('should produce different encrypted values for same plaintext', () => {
    const value = 'same-value'

    const encrypted1 = encryptValue(value, TEST_KEYS.publicKey)
    const encrypted2 = encryptValue(value, TEST_KEYS.publicKey)

    // Different due to random IV
    expect(encrypted1).not.toBe(encrypted2)

    // But both decrypt to same value
    expect(decryptValue(encrypted1, TEST_KEYS.privateKey)).toBe(value)
    expect(decryptValue(encrypted2, TEST_KEYS.privateKey)).toBe(value)
  })
})

describe('E2E - File Operations', () => {
  beforeEach(() => {
    setupTestDir()
  })

  afterEach(() => {
    cleanupTestDir()
  })

  it('should encrypt a .env file', () => {
    const envPath = join(TEST_DIR, '.env')
    const keysPath = join(TEST_DIR, '.env.keys')

    // Create test .env file
    writeFileSync(envPath, `
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=secretpassword123
API_KEY=sk_test_1234567890
    `.trim())

    // Encrypt the file
    const result = encryptEnv({
      file: envPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(true)

    // Verify .env.keys was created
    expect(existsSync(keysPath)).toBe(true)

    // Verify .env file was encrypted
    const encryptedContent = readFileSync(envPath, 'utf-8')
    expect(encryptedContent).toContain('encrypted:')
    expect(encryptedContent).toContain('DOTENV_PUBLIC_KEY')
    expect(encryptedContent).not.toContain('secretpassword123')
    expect(encryptedContent).not.toContain('sk_test_1234567890')
  })

  it('should decrypt a .env file', () => {
    const envPath = join(TEST_DIR, '.env-decrypt')
    const keysPath = join(TEST_DIR, '.env-decrypt.keys')

    // Create and encrypt
    writeFileSync(envPath, `
SECRET=my-secret-value
PASSWORD=p@ssw0rd123
    `.trim())

    const encryptResult = encryptEnv({
      file: envPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    expect(encryptResult.success).toBe(true)

    // Verify encrypted
    const encryptedContent = readFileSync(envPath, 'utf-8')
    expect(encryptedContent).toContain('encrypted:')

    // Decrypt
    const decryptResult = decryptEnv({
      file: envPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    expect(decryptResult.success).toBe(true)

    // Verify decrypted
    const decryptedContent = readFileSync(envPath, 'utf-8')
    expect(decryptedContent).toContain('my-secret-value')
    expect(decryptedContent).toContain('p@ssw0rd123')
    expect(decryptedContent).not.toContain('encrypted:')
  })

  it('should set an encrypted value in .env file', () => {
    const envPath = join(TEST_DIR, '.env-set')
    const keysPath = join(TEST_DIR, '.env-set.keys')

    // Set a value
    const result = setEnv('API_KEY', 'sk_live_1234567890', {
      file: envPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(true)

    // Verify file was created and value is encrypted
    const content = readFileSync(envPath, 'utf-8')
    expect(content).toContain('API_KEY')
    expect(content).toContain('encrypted:')
    expect(content).not.toContain('sk_live_1234567890')
  })

  it('should set a plaintext value in .env file', () => {
    const envPath = join(TEST_DIR, '.env-set-plain')

    // Set a plaintext value
    const result = setEnv('PUBLIC_URL', 'https://example.com', {
      file: envPath,
      plain: true,
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(true)

    // Verify file was created and value is plaintext
    const content = readFileSync(envPath, 'utf-8')
    expect(content).toContain('PUBLIC_URL')
    expect(content).toContain('https://example.com')
    expect(content).not.toContain('encrypted:')
  })

  it('should get a value from .env file', () => {
    const envPath = join(TEST_DIR, '.env-get')

    // Create test file
    writeFileSync(envPath, `
KEY1=value1
KEY2=value2
KEY3=value3
    `.trim())

    // Get specific key
    const result = getEnv('KEY2', {
      file: envPath,
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(true)
    expect(result.output).toBe('value2')
  })

  it('should get all values from .env file as JSON', () => {
    const envPath = join(TEST_DIR, '.env-get-all')

    writeFileSync(envPath, `
KEY1=value1
KEY2=value2
KEY3=value3
    `.trim())

    const result = getEnv(undefined, {
      file: envPath,
      all: false,
      format: 'json',
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(true)
    const parsed = JSON.parse(result.output || '{}')
    expect(parsed).toEqual({
      KEY1: 'value1',
      KEY2: 'value2',
      KEY3: 'value3',
    })
  })

  it('should get values in shell format', () => {
    const envPath = join(TEST_DIR, '.env-shell')

    writeFileSync(envPath, `
KEY1=value1
KEY2=value2
    `.trim())

    const result = getEnv(undefined, {
      file: envPath,
      format: 'shell',
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(true)
    expect(result.output).toContain('KEY1=value1')
    expect(result.output).toContain('KEY2=value2')
  })
})

describe('E2E - Multi-Environment', () => {
  beforeEach(() => {
    setupTestDir()
  })

  afterEach(() => {
    cleanupTestDir()
  })

  it('should handle .env and .env.production separately', () => {
    const envPath = join(TEST_DIR, '.env')
    const envProdPath = join(TEST_DIR, '.env.production')
    const keysPath = join(TEST_DIR, '.env.keys')

    // Create .env
    writeFileSync(envPath, 'DB_HOST=localhost')
    encryptEnv({
      file: envPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    // Create .env.production
    writeFileSync(envProdPath, 'DB_HOST=prod.example.com')
    encryptEnv({
      file: envProdPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    // Verify both files have different encrypted content
    const envContent = readFileSync(envPath, 'utf-8')
    const envProdContent = readFileSync(envProdPath, 'utf-8')

    expect(envContent).toContain('encrypted:')
    expect(envProdContent).toContain('encrypted:')

    // Decrypt and verify values are different
    decryptEnv({ file: envPath, keysFile: keysPath, cwd: TEST_DIR })
    decryptEnv({ file: envProdPath, keysFile: keysPath, cwd: TEST_DIR })

    const decryptedEnv = readFileSync(envPath, 'utf-8')
    const decryptedProd = readFileSync(envProdPath, 'utf-8')

    expect(decryptedEnv).toContain('localhost')
    expect(decryptedProd).toContain('prod.example.com')
  })

  it('should maintain separate keys for different environments', () => {
    const keysPath = join(TEST_DIR, '.env.keys-multi')

    // Encrypt different environment files
    const envPath = join(TEST_DIR, '.env')
    const envCiPath = join(TEST_DIR, '.env.ci')

    writeFileSync(envPath, 'SECRET=dev-secret')
    writeFileSync(envCiPath, 'SECRET=ci-secret')

    encryptEnv({ file: envPath, keysFile: keysPath, cwd: TEST_DIR })
    encryptEnv({ file: envCiPath, keysFile: keysPath, cwd: TEST_DIR })

    // Verify keys file has both sets of keys
    const keysContent = readFileSync(keysPath, 'utf-8')
    expect(keysContent).toContain('DOTENV_PUBLIC_KEY=')
    expect(keysContent).toContain('DOTENV_PRIVATE_KEY=')
    expect(keysContent).toContain('DOTENV_PUBLIC_KEY_CI=')
    expect(keysContent).toContain('DOTENV_PRIVATE_KEY_CI=')
  })
})

describe('E2E - Real-World Scenarios', () => {
  beforeEach(() => {
    setupTestDir()
  })

  afterEach(() => {
    cleanupTestDir()
  })

  it('should handle complete database configuration', () => {
    const envPath = join(TEST_DIR, '.env-db')
    const keysPath = join(TEST_DIR, '.env-db.keys')

    const dbConfig = `
# Database Configuration
DB_HOST=db.example.com
DB_PORT=5432
DB_NAME=production_db
DB_USER=app_user
DB_PASSWORD=SuperSecretP@ssw0rd!123
DB_SSL=true
DB_POOL_MIN=2
DB_POOL_MAX=10

# Connection String (will use variable expansion)
DATABASE_URL=postgresql://\${DB_USER}:\${DB_PASSWORD}@\${DB_HOST}:\${DB_PORT}/\${DB_NAME}?ssl=\${DB_SSL}
    `.trim()

    writeFileSync(envPath, dbConfig)

    // Encrypt
    const encryptResult = encryptEnv({
      file: envPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    expect(encryptResult.success).toBe(true)

    // Verify password is encrypted
    const encryptedContent = readFileSync(envPath, 'utf-8')
    expect(encryptedContent).not.toContain('SuperSecretP@ssw0rd!123')

    // Decrypt and verify
    decryptEnv({ file: envPath, keysFile: keysPath, cwd: TEST_DIR })

    const decryptedContent = readFileSync(envPath, 'utf-8')
    expect(decryptedContent).toContain('SuperSecretP@ssw0rd!123')
  })

  it('should handle AWS credentials', () => {
    const envPath = join(TEST_DIR, '.env-aws')
    const keysPath = join(TEST_DIR, '.env-aws.keys')

    const awsConfig = `
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_DEFAULT_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012
S3_BUCKET=my-app-storage
    `.trim()

    writeFileSync(envPath, awsConfig)

    // Encrypt only secret key
    const encryptResult = encryptEnv({
      file: envPath,
      keysFile: keysPath,
      key: 'AWS_SECRET_ACCESS_KEY',
      cwd: TEST_DIR,
    })

    expect(encryptResult.success).toBe(true)

    const content = readFileSync(envPath, 'utf-8')

    // Access key should be plaintext
    expect(content).toContain('AKIAIOSFODNN7EXAMPLE')

    // Secret key should be encrypted
    expect(content).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')
  })

  it('should handle updating encrypted values', () => {
    const envPath = join(TEST_DIR, '.env-update')
    const keysPath = join(TEST_DIR, '.env-update.keys')

    // Initial value
    setEnv('API_KEY', 'old-key-123', {
      file: envPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    // Update value
    setEnv('API_KEY', 'new-key-456', {
      file: envPath,
      keysFile: keysPath,
      cwd: TEST_DIR,
    })

    // Decrypt and verify new value
    decryptEnv({ file: envPath, keysFile: keysPath, cwd: TEST_DIR })

    const content = readFileSync(envPath, 'utf-8')
    expect(content).toContain('new-key-456')
    expect(content).not.toContain('old-key-123')
  })

  it('should preserve comments and formatting during encrypt/decrypt', () => {
    const envPath = join(TEST_DIR, '.env-format')
    const keysPath = join(TEST_DIR, '.env-format.keys')

    const original = `# Application Configuration
APP_NAME=MyApp
APP_ENV=production

# Database
DB_HOST=localhost
DB_PASSWORD=secret123

# API Keys
API_KEY=sk_test_123
`

    writeFileSync(envPath, original)

    // Encrypt
    encryptEnv({ file: envPath, keysFile: keysPath, cwd: TEST_DIR })

    // Decrypt
    decryptEnv({ file: envPath, keysFile: keysPath, cwd: TEST_DIR })

    const result = readFileSync(envPath, 'utf-8')

    // Comments should be preserved
    expect(result).toContain('# Application Configuration')
    expect(result).toContain('# Database')
    expect(result).toContain('# API Keys')
  })
})

describe('E2E - Error Scenarios', () => {
  beforeEach(() => {
    setupTestDir()
  })

  afterEach(() => {
    cleanupTestDir()
  })

  it('should handle missing .env file gracefully', () => {
    const result = getEnv('SOME_KEY', {
      file: join(TEST_DIR, 'nonexistent.env'),
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('should handle missing .env.keys file gracefully', () => {
    const envPath = join(TEST_DIR, '.env-no-keys')
    writeFileSync(envPath, 'KEY=encrypted:abc123')

    const result = decryptEnv({
      file: envPath,
      keysFile: join(TEST_DIR, 'nonexistent.keys'),
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })

  it('should handle getting non-existent key', () => {
    const envPath = join(TEST_DIR, '.env-missing-key')
    writeFileSync(envPath, 'KEY1=value1')

    const result = getEnv('NONEXISTENT', {
      file: envPath,
      cwd: TEST_DIR,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('not found')
  })
})
