# Deployment How-To

This guide covers deploying your Stacks application to production. Learn how to configure cloud settings, use the deployment command, manage environment variables, and set up custom domains.

## Overview

Stacks provides a streamlined deployment experience:

- **Single Command** - Deploy with `buddy deploy`
- **Multiple Providers** - AWS, Vercel, Netlify, and more
- **Zero-Downtime** - Automatic rolling deployments
- **CDN Integration** - Global edge distribution
- **SSL Certificates** - Automatic HTTPS

## Cloud Configuration

Configure your deployment settings in `config/cloud.ts`:

```typescript
// config/cloud.ts
import type { CloudConfig } from '@stacksjs/cloud'

const config: CloudConfig = {
  // Deployment driver
  driver: 'aws', // 'aws' | 'vercel' | 'netlify'

  // Application name (used for resource naming)
  appName: 'my-stacks-app',

  // Deployment environment
  environment: 'production', // 'production' | 'staging' | 'development'

  // AWS Configuration
  aws: {
    region: 'us-east-1',
    accountId: process.env.AWS_ACCOUNT_ID,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },

  // Domain configuration
  domain: {
    name: 'myapp.com',
    subdomain: 'www',
    certificate: {
      provider: 'acm', // AWS Certificate Manager
      autoRenew: true,
    },
  },

  // CDN settings
  cdn: {
    enabled: true,
    provider: 'cloudfront',
    priceClass: 'PriceClass_100', // US, Canada, Europe
    cachePolicy: {
      defaultTTL: 86400, // 24 hours
      maxTTL: 31536000, // 1 year
      minTTL: 0,
    },
  },

  // Compute settings
  compute: {
    memory: 1024, // MB
    timeout: 30, // seconds
    minInstances: 1,
    maxInstances: 10,
    autoScale: {
      enabled: true,
      targetCpuUtilization: 70,
    },
  },

  // Database settings
  database: {
    provider: 'planetscale', // 'planetscale' | 'rds' | 'aurora'
    region: 'us-east-1',
  },

  // Storage settings
  storage: {
    provider: 's3',
    bucket: 'my-stacks-app-assets',
    publicAccess: true,
  },
}

export default config
```

## Using buddy deploy

The `buddy deploy` command handles your entire deployment process.

### Basic Deployment

```bash
# Deploy to production
buddy deploy

# Deploy to staging
buddy deploy --env=staging

# Deploy with verbose output
buddy deploy --verbose
```

### Deployment Options

```bash
# Skip build step (deploy existing build)
buddy deploy --skip-build

# Deploy specific version/tag
buddy deploy --tag=v1.2.3

# Dry run (show what would be deployed)
buddy deploy --dry-run

# Force deployment (bypass checks)
buddy deploy --force

# Deploy with custom config
buddy deploy --config=./custom-cloud.ts
```

### First-Time Setup

For first-time deployments, run the setup command:

```bash
# Initialize cloud infrastructure
buddy cloud:init

# This will:
# - Create necessary cloud resources
# - Set up IAM roles and permissions
# - Configure DNS records
# - Provision SSL certificates
```

## Environment Variables

### Managing Environment Variables

Environment variables keep sensitive data out of your codebase.

#### Local Development

Create a `.env` file in your project root:

```bash
# .env (local development)
APP_NAME=MyStacksApp
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:3000

# Database
DB_CONNECTION=sqlite
DB_DATABASE=./storage/database.sqlite

# Authentication
AUTH_SECRET=your-local-secret-key

# API Keys (local/test keys)
STRIPE_KEY=sk_test_xxx
STRIPE_SECRET=sk_test_xxx
```

#### Production Environment

Set production variables using the CLI:

```bash
# Set individual variable
buddy env:set API_KEY=your-production-api-key --env=production

# Set multiple variables
buddy env:set DB_HOST=prod-db.example.com DB_USER=admin --env=production

# Import from file
buddy env:import .env.production --env=production

# List all variables
buddy env:list --env=production

# Remove a variable
buddy env:remove API_KEY --env=production
```

#### Environment Files by Stage

```bash
.env                 # Local development (not committed)
.env.example         # Template (committed)
.env.staging         # Staging overrides
.env.production      # Production overrides
```

### Accessing Environment Variables

```typescript
// In your application
import { env } from '@stacksjs/env'

// Get value with default
const apiKey = env('API_KEY', 'default-value')

// Required value (throws if missing)
const secretKey = env.required('SECRET_KEY')

// Typed values
const debugMode = env.boolean('APP_DEBUG', false)
const port = env.number('PORT', 3000)
const allowedHosts = env.array('ALLOWED_HOSTS', ['localhost'])
```

### Secrets Management

For sensitive data, use the secrets manager:

```bash
# Store a secret
buddy secret:set DATABASE_PASSWORD "super-secret" --env=production

# Secrets are encrypted at rest and only decrypted at runtime
buddy secret:list --env=production

# Rotate a secret
buddy secret:rotate DATABASE_PASSWORD --env=production
```

## Domain Setup

### Configuring Custom Domains

#### Step 1: Add Domain to Configuration

```typescript
// config/cloud.ts
export default {
  domain: {
    name: 'myapp.com',
    subdomain: 'www', // Results in www.myapp.com
    aliases: [
      'myapp.com', // Redirect root to www
      'app.myapp.com',
    ],
  },
}
```

#### Step 2: Configure DNS

Add the following DNS records with your domain registrar:

```bash
# View required DNS records
buddy domain:dns

# Output:
# Type    Name    Value                          TTL
# A       @       76.76.21.21                   300
# CNAME   www     cname.myapp.stacks.cloud      300
```

#### Step 3: Verify Domain

```bash
# Verify DNS propagation
buddy domain:verify

# Check domain status
buddy domain:status
```

### SSL Certificates

SSL certificates are automatically provisioned and renewed:

```typescript
// config/cloud.ts
export default {
  domain: {
    name: 'myapp.com',
    certificate: {
      provider: 'acm', // AWS Certificate Manager
      autoRenew: true,
      // Or use custom certificate
      // customCert: {
      //   cert: './certs/myapp.crt',
      //   key: './certs/myapp.key',
      // },
    },
  },
}
```

### Multiple Domains

Support multiple domains for your application:

```typescript
// config/cloud.ts
export default {
  domains: [
    {
      name: 'myapp.com',
      primary: true,
    },
    {
      name: 'myapp.io',
      redirect: 'myapp.com', // Redirect to primary
    },
    {
      name: 'api.myapp.com',
      type: 'api', // API-specific routing
    },
  ],
}
```

## Deployment Strategies

### Zero-Downtime Deployments

Stacks uses rolling deployments by default:

```typescript
// config/cloud.ts
export default {
  deployment: {
    strategy: 'rolling', // 'rolling' | 'blue-green' | 'canary'
    healthCheck: {
      path: '/health',
      interval: 30,
      timeout: 5,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
    },
  },
}
```

### Blue-Green Deployments

For instant rollback capability:

```typescript
deployment: {
  strategy: 'blue-green',
  switchover: 'automatic', // or 'manual'
  rollbackOnFailure: true,
}
```

### Canary Deployments

Gradually roll out to a percentage of users:

```typescript
deployment: {
  strategy: 'canary',
  stages: [
    { percentage: 10, duration: '5m' },
    { percentage: 50, duration: '10m' },
    { percentage: 100 },
  ],
  rollbackOnError: true,
}
```

## Monitoring Deployments

### Deployment Status

```bash
# Check deployment status
buddy deploy:status

# View deployment logs
buddy deploy:logs

# View deployment history
buddy deploy:history
```

### Rollback

```bash
# Rollback to previous version
buddy deploy:rollback

# Rollback to specific version
buddy deploy:rollback --version=v1.2.2

# View available rollback versions
buddy deploy:versions
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun test

      - name: Build
        run: bun run build

      - name: Deploy
        run: bun run deploy
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_ACCOUNT_ID: ${{ secrets.AWS_ACCOUNT_ID }}
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

test:
  stage: test
  script:
    - bun install
    - bun test

build:
  stage: build
  script:
    - bun run build
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  script:
    - bun run deploy
  only:
    - main
  environment:
    name: production
    url: https://myapp.com
```

## Production Checklist

Before deploying to production, ensure:

### Security

- [ ] Environment variables are set (not hardcoded)
- [ ] Debug mode is disabled (`APP_DEBUG=false`)
- [ ] HTTPS is enforced
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] Authentication secrets are rotated

### Performance

- [ ] Assets are minified and compressed
- [ ] CDN is configured
- [ ] Database indexes are optimized
- [ ] Caching is enabled
- [ ] Images are optimized

### Reliability

- [ ] Health check endpoint exists
- [ ] Error monitoring is configured
- [ ] Backup strategy is in place
- [ ] Rollback procedure is tested

### Configuration

```typescript
// config/app.ts (production settings)
export default {
  env: 'production',
  debug: false,
  url: 'https://myapp.com',

  // Security headers
  security: {
    https: true,
    hsts: {
      enabled: true,
      maxAge: 31536000,
      includeSubdomains: true,
    },
    contentSecurityPolicy: true,
  },

  // Caching
  cache: {
    enabled: true,
    driver: 'redis',
    ttl: 3600,
  },

  // Logging
  logging: {
    level: 'error',
    channel: 'cloudwatch',
  },
}
```

## Troubleshooting

### Common Issues

**Deployment fails with permission error:**

```bash
# Check AWS credentials
buddy cloud:check-credentials

# Verify IAM permissions
buddy cloud:check-permissions
```

**Domain not resolving:**

```bash
# Check DNS propagation
buddy domain:verify --verbose

# Clear CDN cache
buddy cdn:purge
```

**Application errors after deployment:**

```bash
# View application logs
buddy logs --env=production

# Check health status
buddy health:check --env=production

# Quick rollback
buddy deploy:rollback
```

## Next Steps

Now that you know how to deploy, continue to:

- [Testing How-To](/bootcamp/how-to/testing) - Test before deploying
- [Authentication How-To](/bootcamp/how-to/authentication) - Secure your deployed app

## Related Documentation

- [AWS Deployment Guide](https://docs.aws.amazon.com/)
- [Cloudflare DNS Setup](https://developers.cloudflare.com/dns/)
- [SSL/TLS Best Practices](https://ssl-config.mozilla.org/)
