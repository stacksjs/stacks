# Environment Configuration

This guide covers managing environment configuration and secrets in your Stacks application, including environment files, configuration validation, and secure secrets management.

## Getting Started

Stacks uses environment files (`.env`) for configuration and provides type-safe access to configuration values.

## Environment Files

### Basic Structure

```env
# .env
APP_NAME="My Application"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000
APP_KEY=base64:your-32-character-secret-key

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=stacks
DB_USERNAME=root
DB_PASSWORD=secret

# Cache
CACHE_DRIVER=redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null

# Mail
MAIL_MAILER=ses
MAIL_FROM_ADDRESS=hello@example.com
MAIL_FROM_NAME="${APP_NAME}"

# AWS
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

### Environment-Specific Files

Create separate files for different environments:

```
.env                 # Default/shared values
.env.local           # Local development overrides
.env.development     # Development environment
.env.staging         # Staging environment
.env.production      # Production environment
.env.testing         # Testing environment
```

### Loading Priority

Files are loaded in this order (later files override earlier ones):

1. `.env`
2. `.env.local`
3. `.env.{NODE_ENV}`
4. `.env.{NODE_ENV}.local`

## Accessing Configuration

### Using the Config Helper

```ts
import { config } from '@stacksjs/config'

// Access config values
const appName = config.app.name
const dbHost = config.database.host
const mailFrom = config.email.from.address

// Access nested values
const stripeKey = config.services.stripe.secret_key
```

### Direct Environment Access

```ts
// Using process.env (not recommended for app code)
const appEnv = process.env.APP_ENV

// Using Bun's env
const dbPassword = Bun.env.DB_PASSWORD
```

### Type-Safe Configuration

```ts
// config/app.ts
export default {
  name: process.env.APP_NAME || 'Stacks',
  env: process.env.APP_ENV || 'production',
  debug: process.env.APP_DEBUG === 'true',
  url: process.env.APP_URL || 'http://localhost:3000',
  key: process.env.APP_KEY,
  timezone: process.env.APP_TIMEZONE || 'UTC',
}
```

## Configuration Files

### App Configuration

```ts
// config/app.ts
export default {
  name: process.env.APP_NAME || 'Stacks',
  env: process.env.APP_ENV || 'production',
  debug: process.env.APP_DEBUG === 'true',
  url: process.env.APP_URL || 'http://localhost:3000',
  key: process.env.APP_KEY,
  locale: 'en',
  fallback_locale: 'en',
  timezone: process.env.APP_TIMEZONE || 'UTC',
}
```

### Database Configuration

```ts
// config/database.ts
export default {
  default: process.env.DB_CONNECTION || 'mysql',

  connections: {
    mysql: {
      driver: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_DATABASE || 'stacks',
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
    },

    sqlite: {
      driver: 'sqlite',
      database: process.env.DB_DATABASE || 'database.sqlite',
    },
  },
}
```

### Services Configuration

```ts
// config/services.ts
export default {
  stripe: {
    secret_key: process.env.STRIPE_SECRET_KEY,
    publishable_key: process.env.STRIPE_PUBLISHABLE_KEY,
    webhook_secret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  aws: {
    access_key_id: process.env.AWS_ACCESS_KEY_ID,
    secret_access_key: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    bucket: process.env.AWS_BUCKET,
  },

  github: {
    client_id: process.env.GITHUB_CLIENT_ID,
    client_secret: process.env.GITHUB_CLIENT_SECRET,
  },
}
```

## Configuration Validation

### Validating Required Variables

```ts
// bootstrap/validate-env.ts
const requiredEnvVars = [
  'APP_KEY',
  'DB_HOST',
  'DB_DATABASE',
  'DB_USERNAME',
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}

// Validate APP_KEY format
if (!process.env.APP_KEY?.startsWith('base64:')) {
  throw new Error('APP_KEY must be a base64-encoded string starting with "base64:"')
}

// Validate APP_ENV
const validEnvs = ['local', 'development', 'staging', 'production', 'testing']
if (!validEnvs.includes(process.env.APP_ENV || '')) {
  console.warn(`Unknown APP_ENV: ${process.env.APP_ENV}`)
}
```

### Using Zod for Validation

```ts
import { z } from 'zod'

const envSchema = z.object({
  APP_NAME: z.string().default('Stacks'),
  APP_ENV: z.enum(['local', 'development', 'staging', 'production', 'testing']),
  APP_DEBUG: z.string().transform(val => val === 'true'),
  APP_URL: z.string().url(),
  APP_KEY: z.string().startsWith('base64:'),

  DB_CONNECTION: z.enum(['mysql', 'sqlite', 'postgres']).default('mysql'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.string().transform(Number).default('3306'),
  DB_DATABASE: z.string(),
  DB_USERNAME: z.string(),
  DB_PASSWORD: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_').optional(),
})

export const env = envSchema.parse(process.env)
```

## Secrets Management

### Generating App Key

```bash
# Generate a new app key
bun run buddy key:generate

# Or manually
openssl rand -base64 32
```

### Encrypted Environment Files

```ts
import { encrypt, decrypt } from '@stacksjs/security'

// Encrypt sensitive values before storing
const encryptedDbPassword = encrypt(process.env.DB_PASSWORD!)

// Decrypt when needed
const dbPassword = decrypt(encryptedDbPassword)
```

### Using AWS Secrets Manager

```ts
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

const client = new SecretsManagerClient({ region: 'us-east-1' })

async function getSecret(secretName: string): Promise<string> {
  const command = new GetSecretValueCommand({ SecretId: secretName })
  const response = await client.send(command)

  if (response.SecretString) {
    return response.SecretString
  }

  throw new Error('Secret not found')
}

// Load secrets at startup
async function loadSecrets() {
  const secrets = JSON.parse(await getSecret('my-app/production'))

  process.env.DB_PASSWORD = secrets.DB_PASSWORD
  process.env.STRIPE_SECRET_KEY = secrets.STRIPE_SECRET_KEY
}
```

### Using HashiCorp Vault

```ts
import Vault from 'node-vault'

const vault = Vault({
  endpoint: process.env.VAULT_ADDR,
  token: process.env.VAULT_TOKEN,
})

async function loadVaultSecrets() {
  const { data } = await vault.read('secret/data/my-app')

  Object.assign(process.env, data.data)
}
```

## Environment Helpers

### Checking Environment

```ts
import { config } from '@stacksjs/config'

function isProduction(): boolean {
  return config.app.env === 'production'
}

function isDevelopment(): boolean {
  return config.app.env === 'development' || config.app.env === 'local'
}

function isTesting(): boolean {
  return config.app.env === 'testing'
}

function isDebug(): boolean {
  return config.app.debug === true
}
```

### Environment-Based Execution

```ts
// Only in development
if (isDevelopment()) {
  console.log('Debug info:', data)
}

// Only in production
if (isProduction()) {
  await sendToAnalytics(event)
}

// Toggle features
const features = {
  newDashboard: process.env.FEATURE_NEW_DASHBOARD === 'true',
  betaAPI: process.env.FEATURE_BETA_API === 'true',
}
```

## Configuration Caching

### Cache Configuration

```bash
# Cache all configuration for production
bun run buddy config:cache

# Clear cached configuration
bun run buddy config:clear
```

### Manual Caching

```ts
import { writeFile, readFile } from 'fs/promises'

async function cacheConfig() {
  const config = {
    app: (await import('./config/app')).default,
    database: (await import('./config/database')).default,
    services: (await import('./config/services')).default,
  }

  await writeFile(
    'storage/framework/cache/config.json',
    JSON.stringify(config)
  )
}

async function loadCachedConfig() {
  try {
    const cached = await readFile('storage/framework/cache/config.json', 'utf-8')
    return JSON.parse(cached)
  } catch {
    return null
  }
}
```

## Best Practices

### DO

```ts
// Use config helper
const appUrl = config.app.url

// Use default values
const timeout = process.env.REQUEST_TIMEOUT || '30000'

// Validate at startup
if (!process.env.STRIPE_SECRET_KEY && isProduction()) {
  throw new Error('STRIPE_SECRET_KEY is required in production')
}

// Type coerce properly
const port = parseInt(process.env.PORT || '3000', 10)
const debug = process.env.DEBUG === 'true'
```

### DON'T

```ts
// Don't commit .env files
// Add to .gitignore: .env*, !.env.example

// Don't hardcode secrets
const apiKey = 'sk_live_xxx' // Bad!

// Don't access process.env directly in app code
const dbHost = process.env.DB_HOST // Use config.database.host instead

// Don't use string comparison for booleans
if (process.env.DEBUG) { } // 'false' is truthy!
```

## Example .env.example

```env
# Application
APP_NAME="My App"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000
APP_KEY=

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=stacks
DB_USERNAME=root
DB_PASSWORD=

# Cache & Session
CACHE_DRIVER=file
SESSION_DRIVER=file

# Mail
MAIL_MAILER=log
MAIL_FROM_ADDRESS=hello@example.com
MAIL_FROM_NAME="${APP_NAME}"

# AWS (optional)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
```

This documentation covers the essential environment configuration and secrets management functionality. Each approach is designed for secure and maintainable configuration handling.
