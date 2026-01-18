# Cloud

Stacks provides first-class cloud deployment support with automated infrastructure provisioning. Deploy your applications to AWS with a single command.

## Overview

Stacks Cloud offers:

- **One-command deployment** - Deploy with `buddy deploy`
- **Automated infrastructure** - AWS resources provisioned automatically
- **Zero-downtime updates** - Rolling deployments with health checks
- **Automatic scaling** - Scale based on demand
- **Built-in CDN** - CloudFront for static assets
- **SSL/TLS** - Automatic certificate management

## Quick Start

### Prerequisites

1. AWS account with appropriate permissions
2. AWS CLI configured (`aws configure`)
3. Stacks project initialized

### First Deployment

```bash
# Configure cloud settings
buddy cloud:init

# Deploy to production
buddy deploy
```

## Cloud Configuration

```typescript
// config/cloud.ts
import { defineCloudConfig } from '@stacksjs/config'

export default defineCloudConfig({
  provider: 'aws',

  region: process.env.AWS_REGION || 'us-east-1',

  domain: 'myapp.com',

  compute: {
    type: 'serverless', // 'serverless' | 'container' | 'vm'
    memory: 1024, // MB for Lambda
    timeout: 30, // seconds
  },

  database: {
    type: 'aurora-serverless',
    minCapacity: 0.5,
    maxCapacity: 4,
    autoPause: true,
    pauseAfter: 300, // 5 minutes
  },

  storage: {
    bucket: 'myapp-storage',
    cdn: true,
  },

  cache: {
    type: 'elasticache',
    nodeType: 'cache.t3.micro',
  },

  cdn: {
    enabled: true,
    priceClass: 'PriceClass_100',
    customDomain: true,
  },
})
```

## Deployment Environments

### Development

```bash
# Deploy to development
buddy deploy --env=development
```

### Staging

```bash
# Deploy to staging
buddy deploy --env=staging
```

### Production

```bash
# Deploy to production
buddy deploy --env=production

# Or simply
buddy deploy
```

## Infrastructure Components

### Compute Options

#### Serverless (Lambda)

Best for: Variable workloads, cost optimization

```typescript
compute: {
  type: 'serverless',
  memory: 1024,
  timeout: 30,
  provisioned: 5, // Optional: provisioned concurrency
}
```

#### Containers (ECS/Fargate)

Best for: Consistent workloads, long-running processes

```typescript
compute: {
  type: 'container',
  cpu: 256,
  memory: 512,
  desiredCount: 2,
  minCount: 1,
  maxCount: 10,
}
```

#### Virtual Machines (EC2)

Best for: Maximum control, specific requirements

```typescript
compute: {
  type: 'vm',
  instanceType: 't3.small',
  minInstances: 2,
  maxInstances: 10,
}
```

### Database Options

#### Aurora Serverless

```typescript
database: {
  type: 'aurora-serverless',
  engine: 'mysql', // or 'postgres'
  minCapacity: 0.5,
  maxCapacity: 8,
  autoPause: true,
}
```

#### RDS

```typescript
database: {
  type: 'rds',
  engine: 'mysql',
  instanceClass: 'db.t3.small',
  multiAZ: true,
  storage: 100, // GB
}
```

#### DynamoDB

```typescript
database: {
  type: 'dynamodb',
  billingMode: 'PAY_PER_REQUEST',
}
```

### Cache Options

#### ElastiCache (Redis)

```typescript
cache: {
  type: 'elasticache',
  engine: 'redis',
  nodeType: 'cache.t3.micro',
  numNodes: 1,
}
```

#### DynamoDB Accelerator (DAX)

```typescript
cache: {
  type: 'dax',
  nodeType: 'dax.t3.small',
}
```

### Storage

```typescript
storage: {
  bucket: 'myapp-storage',
  versioning: true,
  encryption: true,
  cdn: true,
  cors: [
    {
      allowedOrigins: ['https://myapp.com'],
      allowedMethods: ['GET', 'PUT'],
    },
  ],
}
```

### CDN (CloudFront)

```typescript
cdn: {
  enabled: true,
  priceClass: 'PriceClass_100', // US, Canada, Europe
  customDomain: true,
  certificate: 'auto', // Automatic ACM certificate
  compression: true,
  http2: true,
}
```

## Domain & SSL

### Custom Domain

```typescript
domain: {
  name: 'myapp.com',
  hostedZone: 'myapp.com',
  certificate: 'auto',
  subdomains: {
    api: 'api.myapp.com',
    cdn: 'cdn.myapp.com',
  },
}
```

### Automatic SSL

Stacks automatically provisions and renews SSL certificates via AWS Certificate Manager.

## Environment Variables

### Setting Variables

```bash
# Set a single variable
buddy cloud:env APP_KEY=secret123

# Set multiple variables
buddy cloud:env APP_KEY=secret123 DB_PASSWORD=dbpass

# From .env file
buddy cloud:env --file=.env.production
```

### Viewing Variables

```bash
# List all environment variables
buddy cloud:env:list

# Get a specific variable
buddy cloud:env:get APP_KEY
```

## Scaling

### Auto Scaling

```typescript
scaling: {
  enabled: true,
  minInstances: 2,
  maxInstances: 20,
  targetCPU: 70, // Scale when CPU > 70%
  targetMemory: 80,
  scaleInCooldown: 300,
  scaleOutCooldown: 60,
}
```

### Manual Scaling

```bash
# Scale to specific count
buddy cloud:scale 5

# Scale based on environment
buddy cloud:scale 10 --env=production
```

## Monitoring

### CloudWatch Integration

```typescript
monitoring: {
  enabled: true,
  metrics: ['cpu', 'memory', 'requests', 'errors'],
  alarms: {
    errorRate: {
      threshold: 5,
      period: 60,
      notification: 'alerts@myapp.com',
    },
    latency: {
      threshold: 1000, // ms
      period: 60,
      notification: 'alerts@myapp.com',
    },
  },
}
```

### Logs

```bash
# View recent logs
buddy cloud:logs

# Follow logs in real-time
buddy cloud:logs --follow

# Filter by function/service
buddy cloud:logs --function=api
```

## Deployments

### Zero-Downtime Deployment

```bash
# Default deployment (zero-downtime)
buddy deploy

# Force immediate deployment
buddy deploy --force
```

### Rollback

```bash
# Rollback to previous version
buddy cloud:rollback

# Rollback to specific version
buddy cloud:rollback v1.2.3
```

### Deployment History

```bash
# View deployment history
buddy cloud:deployments

# View specific deployment
buddy cloud:deployment abc123
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

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun test

      - name: Deploy
        run: bun run deploy
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

## Cost Optimization

### Serverless

- Use Aurora Serverless with auto-pause
- Configure appropriate Lambda memory
- Use CloudFront caching effectively

### Containers

- Use Spot instances for non-critical workloads
- Right-size your containers
- Implement efficient auto-scaling

### General

```bash
# View estimated costs
buddy cloud:costs

# View cost breakdown
buddy cloud:costs --breakdown
```

## Security

### IAM Roles

Stacks creates least-privilege IAM roles automatically.

### VPC Configuration

```typescript
vpc: {
  enabled: true,
  cidr: '10.0.0.0/16',
  privateSubnets: 2,
  publicSubnets: 2,
  natGateway: true,
}
```

### WAF (Web Application Firewall)

```typescript
waf: {
  enabled: true,
  rules: ['AWSManagedRulesCommonRuleSet', 'AWSManagedRulesKnownBadInputsRuleSet'],
  rateLimit: 1000, // requests per 5 minutes
}
```

## Commands Reference

```bash
# Initialize cloud configuration
buddy cloud:init

# Deploy application
buddy deploy

# View deployment status
buddy cloud:status

# View logs
buddy cloud:logs

# Scale application
buddy cloud:scale <count>

# Rollback deployment
buddy cloud:rollback

# Destroy infrastructure
buddy cloud:destroy
```

## Best Practices

1. **Start small** - Begin with serverless, scale as needed
2. **Use staging** - Test deployments in staging first
3. **Monitor costs** - Review billing regularly
4. **Enable alerts** - Set up CloudWatch alarms
5. **Secure secrets** - Use environment variables for sensitive data

## Related

- [Configuration](/guide/config) - Application configuration
- [CI/CD](/guide/ci) - Continuous integration setup
- [Testing](/guide/testing) - Test before deploying
