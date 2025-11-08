# @stacksjs/env

A secure .env file management package with built-in encryption support for Bun and Node.js.

## Features

- 🔐 **Automatic Encryption/Decryption** - Secure your environment variables with public-key cryptography
- 🚀 **Bun Plugin** - Seamless integration with Bun's runtime
- 🔑 **secp256k1 ECIES** - Industry-standard elliptic curve encryption
- 📝 **Variable Expansion** - Support for `${VAR}`, defaults, and alternates
- 🔧 **Command Substitution** - Execute commands with `$(command)`
- 🎯 **Multi-Environment** - Manage multiple .env files for different environments
- 🛠️ **CLI Tools** - Full-featured CLI via buddy commands

## Installation

```bash
bun add @stacksjs/env
```

## Quick Start

### 1. Auto-load .env files

```typescript
import { autoLoadEnv } from '@stacksjs/env'

// Automatically loads .env files based on NODE_ENV or DOTENV_ENV
autoLoadEnv()

// Now use your environment variables
console.log(process.env.MY_SECRET)
```

### 2. Programmatic Usage

```typescript
import { loadEnv } from '@stacksjs/env'

// Load specific .env files
loadEnv({
  path: ['.env.local', '.env'],
  overload: false,
})
```

### 3. Bun Plugin

Add to your `bunfig.toml`:

```toml
preload = ["./storage/framework/core/env/plugin.ts"]
```

Or import in your preloader:

```typescript
import '@stacksjs/env/plugin'
```

## Encryption

### Encrypting .env Files

Use the buddy CLI to encrypt your environment variables:

```bash
# Encrypt .env file
buddy env:encrypt

# Encrypt specific file
buddy env:encrypt --file .env.production

# Encrypt specific keys only
buddy env:encrypt -k "SECRET_*"

# Exclude specific keys from encryption
buddy env:encrypt -ek "PUBLIC_*"
```

This will:
1. Generate a public/private keypair
2. Store keys in `.env.keys` (keep this secure!)
3. Encrypt values in your .env file
4. Add `DOTENV_PUBLIC_KEY` to your .env file

### Decrypting .env Files

```bash
# Decrypt .env file
buddy env:decrypt

# Decrypt specific file
buddy env:decrypt --file .env.production
```

### How Encryption Works

The encryption uses **secp256k1 ECIES** (Elliptic Curve Integrated Encryption Scheme):

1. A keypair is generated using secp256k1 (same as Bitcoin)
2. Each value is encrypted with AES-256-GCM using an ephemeral key
3. The ephemeral key is encrypted with the public key
4. Only the private key can decrypt the values

**Example encrypted .env:**

```ini
#/-------------------[DOTENV_PUBLIC_KEY]--------------------/
#/            public-key encryption for .env files          /
#/       [how it works](https://stacksjs.org/encryption)   /
#/----------------------------------------------------------/
DOTENV_PUBLIC_KEY="034af93e93708b994c10f236c96ef88e47291066946cce2e8d98c9e02c741ced45"

# .env
API_KEY="encrypted:BDqDBibm4wsYqMpCjTQ6BsDHmMadg9K3dAt+Z9HPMfLEIRVz50hmLXPXRuDBXaJi..."
DB_PASSWORD="encrypted:AKx8Bh3m5xtZrNqDkUP7CuEInOcfg9L4eBy/2qt59vbSU0aN9WSmN..."
```

## CLI Commands

All commands are available through the `buddy` CLI:

### Get Environment Variables

```bash
# Get a specific variable
buddy env:get API_KEY

# Get all variables as JSON
buddy env:get --all

# Get all variables in shell format
buddy env:get --all --format shell

# Pretty print JSON
buddy env:get --all --pretty
```

### Set Environment Variables

```bash
# Set a variable (encrypted by default)
buddy env:set API_KEY "my-secret-value"

# Set without encryption
buddy env:set PUBLIC_URL "https://example.com" --plain

# Set in specific file
buddy env:set API_KEY "value" --file .env.production
```

### Manage Keypairs

```bash
# View keypair
buddy env:keypair

# View keypair for specific environment
buddy env:keypair --file .env.production

# Get specific key
buddy env:keypair DOTENV_PRIVATE_KEY

# Output in shell format
buddy env:keypair --format shell
```

### Rotate Keys

```bash
# Rotate keypair and re-encrypt all values
buddy env:rotate

# Rotate for specific environment
buddy env:rotate --file .env.production
```

## Variable Expansion

The env parser supports advanced variable expansion:

### Basic Expansion

```ini
USERNAME="john"
DATABASE_URL="postgres://${USERNAME}@localhost/mydb"
# Result: postgres://john@localhost/mydb
```

### Default Values

```ini
# Use default if unset or empty
DATABASE_HOST=${DB_HOST:-localhost}
DATABASE_PORT=${DB_PORT:-5432}

# Use default only if unset (empty is ok)
API_URL=${API_BASE_URL-https://api.example.com}
```

### Alternate Values

```ini
NODE_ENV=production

# Use alternate if set and non-empty
DEBUG_MODE=${NODE_ENV:+false}
LOG_LEVEL=${NODE_ENV:+error}

# Use alternate if set (empty is ok)
CACHE_ENABLED=${NODE_ENV+true}
```

### Command Substitution

```ini
# Execute command and use output
CURRENT_USER=$(whoami)
BUILD_TIME=$(date +%s)
GIT_COMMIT=$(git rev-parse HEAD)
```

## Multi-Environment Support

Load different .env files based on environment:

```bash
# .env.local (highest priority)
# .env.development
# .env.production
# .env (lowest priority)
```

The loader will automatically detect `NODE_ENV` or `DOTENV_ENV` and load the appropriate files.

### Environment-Specific Keys

Keys are automatically namespaced by environment:

```ini
# .env.keys
DOTENV_PUBLIC_KEY="..."
DOTENV_PRIVATE_KEY="..."

DOTENV_PUBLIC_KEY_PRODUCTION="..."
DOTENV_PRIVATE_KEY_PRODUCTION="..."

DOTENV_PUBLIC_KEY_CI="..."
DOTENV_PRIVATE_KEY_CI="..."
```

## Security Best Practices

1. **Never commit `.env.keys`** - Add to `.gitignore`
2. **Commit encrypted `.env` files** - They're safe to commit
3. **Store private keys securely** - Use your CI/CD secrets manager
4. **Rotate keys regularly** - Use `buddy env:rotate`
5. **Use environment-specific keys** - Different keys for dev/staging/prod

## API Reference

### `autoLoadEnv(options?)`

Automatically load .env files based on environment.

```typescript
import { autoLoadEnv } from '@stacksjs/env'

autoLoadEnv({
  env: 'production',  // Override environment detection
  overload: false,    // Don't override existing vars
  quiet: true,        // Suppress output
  cwd: '/path/to/project'
})
```

### `loadEnv(options)`

Load specific .env files.

```typescript
import { loadEnv } from '@stacksjs/env'

loadEnv({
  path: ['.env.local', '.env'],
  overload: false,
  privateKey: 'your-private-key',
  keysFile: '.env.keys',
  quiet: false
})
```

### `encryptEnv(options)`

Encrypt a .env file.

```typescript
import { encryptEnv } from '@stacksjs/env'

const result = encryptEnv({
  file: '.env',
  keysFile: '.env.keys',
  key: 'SECRET_*',        // Only encrypt keys matching pattern
  excludeKey: 'PUBLIC_*',  // Exclude keys matching pattern
  stdout: false
})
```

### `decryptEnv(options)`

Decrypt a .env file.

```typescript
import { decryptEnv } from '@stacksjs/env'

const result = decryptEnv({
  file: '.env',
  keysFile: '.env.keys',
  stdout: false
})
```

### `setEnv(key, value, options)`

Set an environment variable.

```typescript
import { setEnv } from '@stacksjs/env'

setEnv('API_KEY', 'my-secret', {
  file: '.env',
  keysFile: '.env.keys',
  plain: false  // Encrypt by default
})
```

### `getEnv(key?, options)`

Get environment variable(s).

```typescript
import { getEnv } from '@stacksjs/env'

// Get single value
const result = getEnv('API_KEY', {
  file: '.env',
  keysFile: '.env.keys'
})

// Get all values
const result = getEnv(undefined, {
  all: true,
  format: 'json',  // or 'shell' or 'eval'
  prettyPrint: true
})
```

## Migration from dotenvx

This package replaces `@dotenvx/dotenvx` and `bun-plugin-dotenvx` with a native Bun implementation.

### Breaking Changes

None! The API is designed to be compatible with dotenvx.

### Migration Steps

1. Update your `bunfig.toml` preload
2. Update imports from `@dotenvx/dotenvx` to `@stacksjs/env`
3. buddy commands remain the same

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
