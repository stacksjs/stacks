# Config Package

A configuration management system providing type-safe configuration loading, environment variable handling, defaults, overrides, and runtime configuration access.

## Installation

```bash
bun add @stacksjs/config
```

## Basic Usage

```typescript
import { config, app, database, cache } from '@stacksjs/config'

// Access full config
console.log(config.app.name)
console.log(config.database.connection)

// Access specific namespaces
console.log(app.name)
console.log(database.driver)
console.log(cache.driver)
```

## Configuration Structure

### Config Directory

Stacks loads configuration from the `config/` directory:

```
config/
  ai.ts
  analytics.ts
  app.ts
  auth.ts
  cache.ts
  cli.ts
  cloud.ts
  database.ts
  dns.ts
  docs.ts
  email.ts
  errors.ts
  filesystems.ts
  git.ts
  hashing.ts
  library.ts
  logging.ts
  notification.ts
  payment.ts
  ports.ts
  queue.ts
  realtime.ts
  saas.ts
  search-engine.ts
  security.ts
  services.ts
  team.ts
  ui.ts
```

### Configuration Files

Each config file exports a typed configuration object:

```typescript
// config/app.ts
export default {
  name: 'My Application',
  env: 'local',
  debug: true,
  url: 'http://localhost:3000',
  timezone: 'UTC',
  locale: 'en',
  fallbackLocale: 'en',
  key: process.env.APP_KEY,
}
```

## Accessing Configuration

### Direct Access

```typescript
import { config } from '@stacksjs/config'

// Access nested values
const appName = config.app.name
const dbDriver = config.database.driver
const cacheDriver = config.cache.driver
```

### Namespace Exports

```typescript
import {
  app,
  database,
  cache,
  auth,
  ai,
  cloud,
  email,
  notification,
  queue,
  searchEngine,
  filesystems
} from '@stacksjs/config'

// Use directly
console.log(app.name)
console.log(database.driver)
console.log(cache.driver)
```

### Available Namespaces

```typescript
import {
  ai,              // AI/ML configuration
  analytics,       // Analytics settings
  app,             // Application settings
  auth,            // Authentication config
  cache,           // Cache configuration
  cli,             // CLI settings
  cloud,           // Cloud deployment config
  database,        // Database configuration
  dns,             // DNS settings
  docs,            // Documentation config
  email,           // Email settings
  errors,          // Error handling config
  filesystems,     // Storage configuration
  git,             // Git settings
  hashing,         // Hashing algorithms
  library,         // Library settings
  logging,         // Logging configuration
  notification,    // Notification channels
  payment,         // Payment configuration
  ports,           // Port assignments
  queue,           // Queue configuration
  realtime,        // WebSocket/realtime
  saas,            // SaaS settings
  searchEngine,    // Search configuration
  security,        // Security settings
  services,        // External services
  team,            // Team settings
  ui,              // UI configuration
} from '@stacksjs/config'
```

## Environment Variables

### Loading Environment Variables

Environment variables are automatically loaded from `.env` files:

```env
# .env
APP_NAME="My Application"
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000

DB_CONNECTION=sqlite
DB_DATABASE=database/stacks.sqlite

CACHE_DRIVER=memory
QUEUE_DRIVER=sync
```

### Using Environment Variables

```typescript
// config/app.ts
export default {
  name: process.env.APP_NAME || 'Stacks',
  env: process.env.APP_ENV || 'production',
  debug: process.env.APP_DEBUG === 'true',
  url: process.env.APP_URL || 'http://localhost',
}
```

### Typed Environment Access

```typescript
// Environment with type coercion
const debug = process.env.APP_DEBUG === 'true'
const port = parseInt(process.env.APP_PORT || '3000', 10)
const hosts = (process.env.ALLOWED_HOSTS || '').split(',')
```

## Configuration Defaults

### Default Configuration

```typescript
// config/defaults.ts
export const defaults: StacksOptions = {
  app: {
    name: 'Stacks',
    env: 'local',
    debug: false,
    url: 'http://localhost',
    timezone: 'UTC',
    locale: 'en',
  },

  database: {
    default: 'sqlite',
    connections: {
      sqlite: {
        driver: 'sqlite',
        database: 'database/stacks.sqlite',
      }
    }
  },

  cache: {
    default: 'memory',
    stores: {
      memory: {
        driver: 'memory',
      }
    }
  },

  // ... other defaults
}
```

### Overrides

```typescript
// config/overrides.ts
export const overrides = {
  // Override specific settings
  app: {
    name: process.env.APP_NAME || 'My App',
  },

  database: {
    default: process.env.DB_CONNECTION || 'sqlite',
  }
}
```

### Merged Configuration

```typescript
// Configuration is merged: defaults -> user config -> overrides
import { defaults, overrides } from '@stacksjs/config'

export const config = {
  ...defaults,
  ...userConfig, // From config/ files
  ...overrides,  // Environment overrides
}
```

## Common Configuration Options

### Application Config

```typescript
// config/app.ts
export default {
  // Application name
  name: 'My Application',

  // Environment (local, development, staging, production)
  env: process.env.APP_ENV || 'local',

  // Debug mode
  debug: process.env.APP_DEBUG === 'true',

  // Application URL
  url: process.env.APP_URL || 'http://localhost:3000',

  // Asset URL (for CDN)
  assetUrl: process.env.ASSET_URL || '',

  // Timezone
  timezone: 'UTC',

  // Locale
  locale: 'en',
  fallbackLocale: 'en',

  // Encryption key
  key: process.env.APP_KEY,
}
```

### Database Config

```typescript
// config/database.ts
export default {
  // Default connection
  default: process.env.DB_CONNECTION || 'sqlite',

  connections: {
    sqlite: {
      driver: 'sqlite',
      database: process.env.DB_DATABASE || 'database/stacks.sqlite',
    },

    mysql: {
      driver: 'mysql',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '3306'),
      database: process.env.DB_DATABASE || 'stacks',
      username: process.env.DB_USERNAME || 'root',
      password: process.env.DB_PASSWORD || '',
    },

    postgres: {
      driver: 'postgres',
      host: process.env.DB_HOST || '127.0.0.1',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_DATABASE || 'stacks',
      username: process.env.DB_USERNAME || 'postgres',
      password: process.env.DB_PASSWORD || '',
    },
  },
}
```

### Cache Config

```typescript
// config/cache.ts
export default {
  // Default cache store
  default: process.env.CACHE_DRIVER || 'memory',

  stores: {
    memory: {
      driver: 'memory',
      maxKeys: -1, // Unlimited
      stdTTL: 0,   // No expiration
    },

    redis: {
      driver: 'redis',
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD || '',
      database: parseInt(process.env.REDIS_DB || '0'),
      prefix: 'stacks_cache:',
    },
  },
}
```

### Queue Config

```typescript
// config/queue.ts
export default {
  // Default queue driver
  default: process.env.QUEUE_DRIVER || 'sync',

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
    },
  },

  // Failed job storage
  failed: {
    driver: 'database',
    table: 'failed_jobs',
  },
}
```

### Auth Config

```typescript
// config/auth.ts
export default {
  // Default guard
  defaults: {
    guard: 'api',
    provider: 'users',
  },

  // Authentication guards
  guards: {
    api: {
      driver: 'token',
      provider: 'users',
    },
  },

  // User providers
  providers: {
    users: {
      driver: 'database',
      model: 'User',
    },
  },

  // Token settings
  tokenExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days
  tokenRotation: 24, // hours
  defaultTokenName: 'auth-token',
  defaultAbilities: ['*'],

  // Password settings
  passwords: {
    expire: 60, // minutes
    throttle: 60, // seconds between reset requests
  },
}
```

### Filesystems Config

```typescript
// config/filesystems.ts
export default {
  // Default disk
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
      key: process.env.AWS_ACCESS_KEY_ID,
      secret: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
      bucket: process.env.AWS_BUCKET,
      url: process.env.AWS_URL,
    },
  },
}
```

## Helper Functions

### Get Config

```typescript
import { getConfig } from '@stacksjs/config'

// Get full configuration
const config = getConfig()

// Access values
console.log(config.app.name)
```

### Determine Environment

```typescript
import { determineAppEnv } from '@stacksjs/config'

const env = determineAppEnv()
// Returns: 'dev' | 'stage' | 'prod' | string

// Based on app.env value:
// 'local', 'development' -> 'dev'
// 'staging' -> 'stage'
// 'production' -> 'prod'
```

## Type Safety

### Configuration Types

```typescript
import type { StacksOptions } from '@stacksjs/types'

// Full configuration type
const config: StacksOptions = {
  app: { name: 'My App', env: 'local', /* ... */ },
  database: { default: 'sqlite', /* ... */ },
  // TypeScript ensures all required fields
}

// Namespace types
import type {
  AppConfig,
  DatabaseConfig,
  CacheConfig,
  AuthConfig
} from '@stacksjs/types'

const appConfig: AppConfig = {
  name: 'My App',
  env: 'local',
  debug: true,
  url: 'http://localhost'
}
```

### IDE Support

Configuration is fully typed, providing:
- Autocomplete for config keys
- Type checking for values
- Documentation on hover
- Refactoring support

## Environment-Specific Config

### Local Development

```env
# .env.local
APP_ENV=local
APP_DEBUG=true
DB_CONNECTION=sqlite
CACHE_DRIVER=memory
QUEUE_DRIVER=sync
```

### Staging

```env
# .env.staging
APP_ENV=staging
APP_DEBUG=false
DB_CONNECTION=postgres
CACHE_DRIVER=redis
QUEUE_DRIVER=database
```

### Production

```env
# .env.production
APP_ENV=production
APP_DEBUG=false
DB_CONNECTION=postgres
CACHE_DRIVER=redis
QUEUE_DRIVER=redis
```

## Edge Cases

### Missing Environment Variables

```typescript
// Provide defaults for missing env vars
export default {
  name: process.env.APP_NAME ?? 'Default Name',
  port: parseInt(process.env.PORT ?? '3000', 10),
  debug: process.env.DEBUG === 'true' // false if undefined
}
```

### Sensitive Configuration

```typescript
// Never log sensitive config
if (process.env.NODE_ENV !== 'production') {
  console.log('Config loaded:', {
    ...config,
    database: { ...config.database, password: '[REDACTED]' },
    services: { ...config.services, apiKey: '[REDACTED]' }
  })
}
```

### Runtime Configuration Changes

```typescript
// Configuration is loaded at startup
// Runtime changes require app restart

// For runtime-configurable values, use cache
await cache.set('feature:enabled', true)
const enabled = await cache.get('feature:enabled')
```

### Config Validation

```typescript
// Validate required config at startup
function validateConfig() {
  const required = [
    'APP_KEY',
    'DB_CONNECTION',
  ]

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required config: ${key}`)
    }
  }
}
```

## API Reference

### Exports

| Export | Description |
|--------|-------------|
| `config` | Full merged configuration |
| `defaults` | Default configuration |
| `overrides` | Override configuration |
| `getConfig()` | Get configuration object |
| `determineAppEnv()` | Get normalized environment |

### Namespace Exports

| Export | Description |
|--------|-------------|
| `ai` | AI configuration |
| `analytics` | Analytics settings |
| `app` | Application config |
| `auth` | Auth configuration |
| `cache` | Cache configuration |
| `cli` | CLI settings |
| `cloud` | Cloud config |
| `database` | Database config |
| `dns` | DNS settings |
| `docs` | Documentation config |
| `email` | Email settings |
| `errors` | Error handling |
| `filesystems` | Storage config |
| `git` | Git settings |
| `hashing` | Hash algorithms |
| `library` | Library settings |
| `logging` | Logging config |
| `notification` | Notification config |
| `payment` | Payment settings |
| `ports` | Port assignments |
| `queue` | Queue configuration |
| `realtime` | Realtime config |
| `saas` | SaaS settings |
| `searchEngine` | Search config |
| `security` | Security settings |
| `services` | External services |
| `team` | Team settings |
| `ui` | UI configuration |

### Configuration Loading Order

1. Default values from `config/defaults.ts`
2. User configuration from `config/*.ts` files
3. Environment overrides from `.env` files
4. Override values from `config/overrides.ts`

Later values override earlier ones.
