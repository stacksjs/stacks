# Configuration

Stacks provides a powerful, type-safe configuration system that centralizes all your application settings. Configure everything from database connections to cloud deployments in one place.

## Overview

Configuration in Stacks follows these principles:

- **Type-safe** - Full TypeScript support with autocompletion
- **Environment-aware** - Different configs for dev, staging, production
- **Centralized** - All settings in one organized location
- **Validated** - Configuration errors caught at startup

## Configuration Files

All configuration lives in the `config/` directory:

```
config/
├── app.ts          # Application settings
├── database.ts     # Database connections
├── cache.ts        # Cache configuration
├── queue.ts        # Queue settings
├── mail.ts         # Email configuration
├── storage.ts      # File storage
├── auth.ts         # Authentication
├── cloud.ts        # Cloud deployment
├── hashing.ts      # Password hashing
├── logging.ts      # Log configuration
├── services.ts     # Third-party services
└── index.ts        # Config export
```

## Application Config

```typescript
// config/app.ts
import { defineAppConfig } from '@stacksjs/config'

export default defineAppConfig({
  name: 'My App',
  env: process.env.APP_ENV || 'development',
  debug: process.env.APP_DEBUG === 'true',
  url: process.env.APP_URL || 'http://localhost:3000',

  timezone: 'UTC',
  locale: 'en',

  key: process.env.APP_KEY,

  providers: [
    // Service providers to load
  ],
})
```

## Database Config

```typescript
// config/database.ts
import { defineDatabaseConfig } from '@stacksjs/config'

export default defineDatabaseConfig({
  default: process.env.DB_CONNECTION || 'sqlite',

  connections: {
    sqlite: {
      driver: 'sqlite',
      database: process.env.DB_DATABASE || 'database/database.sqlite',
    },

    mysql: {
      driver: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      database: process.env.DB_DATABASE || 'stacks',
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
    },

    postgres: {
      driver: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 5432,
      database: process.env.DB_DATABASE || 'stacks',
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
      schema: 'public',
    },
  },

  migrations: {
    table: 'migrations',
    path: 'database/migrations',
  },

  seeders: {
    path: 'database/seeders',
  },
})
```

## Cache Config

```typescript
// config/cache.ts
import { defineCacheConfig } from '@stacksjs/config'

export default defineCacheConfig({
  default: process.env.CACHE_DRIVER || 'file',

  stores: {
    file: {
      driver: 'file',
      path: 'storage/cache',
    },

    redis: {
      driver: 'redis',
      connection: 'cache',
      prefix: 'cache:',
    },

    memory: {
      driver: 'memory',
      maxSize: 100 * 1024 * 1024, // 100MB
    },

    dynamodb: {
      driver: 'dynamodb',
      table: process.env.DYNAMODB_CACHE_TABLE || 'cache',
      region: process.env.AWS_REGION || 'us-east-1',
    },
  },

  prefix: process.env.CACHE_PREFIX || 'stacks_cache_',
  ttl: 3600, // 1 hour default
})
```

## Queue Config

```typescript
// config/queue.ts
import { defineQueueConfig } from '@stacksjs/config'

export default defineQueueConfig({
  default: process.env.QUEUE_CONNECTION || 'sync',

  connections: {
    sync: {
      driver: 'sync',
    },

    database: {
      driver: 'database',
      table: 'jobs',
      queue: 'default',
      retryAfter: 90,
    },

    redis: {
      driver: 'redis',
      connection: 'default',
      queue: 'default',
      retryAfter: 90,
      blockFor: 5,
    },

    sqs: {
      driver: 'sqs',
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      prefix: process.env.SQS_PREFIX,
      queue: process.env.SQS_QUEUE || 'default',
    },
  },

  failed: {
    driver: 'database',
    table: 'failed_jobs',
  },
})
```

## Mail Config

```typescript
// config/mail.ts
import { defineMailConfig } from '@stacksjs/config'

export default defineMailConfig({
  default: process.env.MAIL_MAILER || 'smtp',

  mailers: {
    smtp: {
      driver: 'smtp',
      host: process.env.MAIL_HOST || 'localhost',
      port: Number(process.env.MAIL_PORT) || 587,
      encryption: process.env.MAIL_ENCRYPTION || 'tls',
      username: process.env.MAIL_USERNAME,
      password: process.env.MAIL_PASSWORD,
    },

    ses: {
      driver: 'ses',
      region: process.env.AWS_REGION || 'us-east-1',
    },

    mailgun: {
      driver: 'mailgun',
      domain: process.env.MAILGUN_DOMAIN,
      secret: process.env.MAILGUN_SECRET,
      endpoint: process.env.MAILGUN_ENDPOINT || 'api.mailgun.net',
    },

    log: {
      driver: 'log',
      channel: 'mail',
    },
  },

  from: {
    address: process.env.MAIL_FROM_ADDRESS || 'hello@example.com',
    name: process.env.MAIL_FROM_NAME || 'Stacks App',
  },
})
```

## Storage Config

```typescript
// config/storage.ts
import { defineStorageConfig } from '@stacksjs/config'

export default defineStorageConfig({
  default: process.env.FILESYSTEM_DISK || 'local',

  disks: {
    local: {
      driver: 'local',
      root: 'storage/app',
      visibility: 'private',
    },

    public: {
      driver: 'local',
      root: 'storage/app/public',
      url: '/storage',
      visibility: 'public',
    },

    s3: {
      driver: 's3',
      bucket: process.env.AWS_BUCKET,
      region: process.env.AWS_REGION || 'us-east-1',
      url: process.env.AWS_URL,
      endpoint: process.env.AWS_ENDPOINT,
      forcePathStyle: process.env.AWS_USE_PATH_STYLE === 'true',
    },
  },

  links: {
    'public/storage': 'storage/app/public',
  },
})
```

## Auth Config

```typescript
// config/auth.ts
import { defineAuthConfig } from '@stacksjs/config'

export default defineAuthConfig({
  defaults: {
    guard: 'web',
    provider: 'users',
  },

  guards: {
    web: {
      driver: 'session',
      provider: 'users',
    },

    api: {
      driver: 'token',
      provider: 'users',
      hash: false,
    },
  },

  providers: {
    users: {
      driver: 'database',
      model: 'User',
    },
  },

  passwords: {
    users: {
      provider: 'users',
      table: 'password_reset_tokens',
      expire: 60,
      throttle: 60,
    },
  },

  session: {
    lifetime: 120,
    expireOnClose: false,
  },
})
```

## Environment Variables

Stacks uses a `.env` file for environment-specific configuration:

```env
# .env
APP_NAME="My Stacks App"
APP_ENV=development
APP_KEY=base64:...
APP_DEBUG=true
APP_URL=http://localhost:3000

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=stacks
DB_USERNAME=root
DB_PASSWORD=

CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis

REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=null

MAIL_MAILER=smtp
MAIL_HOST=mailpit
MAIL_PORT=1025

AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=
```

## Accessing Configuration

```typescript
import { config } from '@stacksjs/config'

// Get a value
const appName = config('app.name')
const dbHost = config('database.connections.mysql.host')

// Get with default
const timezone = config('app.timezone', 'UTC')

// Check if config exists
if (config.has('services.stripe')) {
  // Stripe is configured
}

// Get entire section
const mailConfig = config('mail')
```

## Environment Helpers

```typescript
import { env, isProduction, isDevelopment, isLocal } from '@stacksjs/env'

// Get environment variable
const apiKey = env('API_KEY')
const port = env('PORT', 3000) // with default

// Environment checks
if (isProduction()) {
  // Production-only code
}

if (isDevelopment()) {
  // Development-only code
}

// Custom environment check
if (env('APP_ENV') === 'staging') {
  // Staging-only code
}
```

## Configuration Caching

For production, cache your configuration for better performance:

```bash
# Cache configuration
buddy config:cache

# Clear cached configuration
buddy config:clear

# Show current configuration
buddy config:show
```

## Validation

Stacks validates your configuration at startup:

```typescript
// config/validation.ts
import { defineConfigValidation } from '@stacksjs/config'

export default defineConfigValidation({
  required: [
    'APP_KEY',
    'DB_CONNECTION',
  ],

  rules: {
    APP_KEY: (value) => value.length >= 32,
    DB_PORT: (value) => !isNaN(Number(value)),
  },
})
```

## Best Practices

1. **Never commit secrets** - Use `.env` for sensitive values
2. **Use environment variables** - Keep config files environment-agnostic
3. **Validate configuration** - Catch errors early at startup
4. **Cache in production** - Improve boot time with config caching
5. **Type your config** - Use TypeScript for autocompletion and safety

## Related

- [Environment Setup](/bootcamp/local-setup) - Setting up your environment
- [Cloud Deployment](/guide/cloud) - Cloud configuration
- [Database](/basics/models) - Database setup
