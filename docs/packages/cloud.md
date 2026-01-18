# Cloud Package

Comprehensive cloud deployment and infrastructure management for AWS, featuring automated provisioning, serverless deployment, CDN configuration, and managed services integration.

## Installation

```bash
bun add @stacksjs/cloud
```

## Basic Usage

```typescript
import { Cloud } from '@stacksjs/cloud'

// Deploy application to AWS
await Cloud.deploy({
  environment: 'production',
  region: 'us-east-1'
})
```

## Configuration

### Environment Variables

```env
# AWS Credentials
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

# Application Settings
APP_NAME=myapp
APP_ENV=production
APP_DOMAIN=example.com
```

### Cloud Configuration File

```typescript
// config/cloud.ts
export default {
  // Deployment provider
  driver: 'aws',

  // Application settings
  appName: 'myapp',

  // Domain configuration
  domain: 'example.com',
  subdomain: 'api',

  // AWS specific settings
  aws: {
    region: 'us-east-1',
    accountId: '123456789012',
    profile: 'default'
  },

  // CDN settings
  cdn: {
    enabled: true,
    priceClass: 'PriceClass_100',
    origins: {
      api: { type: 's3', path: '/api/*' },
      static: { type: 's3', path: '/static/*' }
    }
  },

  // Database settings
  database: {
    type: 'aurora-serverless',
    minCapacity: 1,
    maxCapacity: 16,
    autoPause: true
  },

  // Cache settings
  cache: {
    type: 'elasticache',
    engine: 'redis',
    nodeType: 'cache.t3.micro'
  }
}
```

## Deployment

### Basic Deployment

```typescript
import { Cloud } from '@stacksjs/cloud'

// Deploy to production
await Cloud.deploy()

// Deploy to specific environment
await Cloud.deploy({ environment: 'staging' })

// Deploy with options
await Cloud.deploy({
  environment: 'production',
  skipBuild: false,
  skipCdn: false,
  verbose: true
})
```

### CLI Deployment

```bash
# Deploy to production
buddy deploy

# Deploy to staging
buddy deploy --env=staging

# Deploy with verbose output
buddy deploy -v

# Skip CDN invalidation
buddy deploy --skip-cdn
```

### Deployment Status

```typescript
import { Cloud } from '@stacksjs/cloud'

// Check deployment status
const status = await Cloud.status()

console.log(status.environment)  // 'production'
console.log(status.version)      // 'v1.2.3'
console.log(status.deployedAt)   // Date
console.log(status.healthy)      // true
```

## Compute

### Lambda Functions

```typescript
import { Compute } from '@stacksjs/cloud'

// Deploy Lambda function
await Compute.deployFunction({
  name: 'api-handler',
  runtime: 'provided.al2',  // Bun runtime
  handler: 'index.handler',
  memory: 1024,
  timeout: 30,
  environment: {
    NODE_ENV: 'production',
    DB_HOST: process.env.DB_HOST
  }
})
```

### Edge Functions

```typescript
import { Compute } from '@stacksjs/cloud'

// Deploy edge function for CDN
await Compute.deployEdgeFunction({
  name: 'origin-request',
  type: 'origin-request',
  code: `
    export async function handler(event) {
      const request = event.Records[0].cf.request
      // Modify request
      return request
    }
  `
})
```

## Storage

### S3 Buckets

```typescript
import { Storage } from '@stacksjs/cloud'

// Create storage bucket
await Storage.createBucket({
  name: 'myapp-uploads',
  publicRead: false,
  versioning: true,
  cors: [{
    allowedOrigins: ['https://example.com'],
    allowedMethods: ['GET', 'PUT', 'POST'],
    allowedHeaders: ['*']
  }]
})

// Configure lifecycle rules
await Storage.setLifecycle('myapp-uploads', [{
  id: 'archive-old-files',
  prefix: 'uploads/',
  transitions: [{
    days: 90,
    storageClass: 'GLACIER'
  }],
  expiration: { days: 365 }
}])
```

### File System (EFS)

```typescript
import { FileSystem } from '@stacksjs/cloud'

// Create EFS for persistent storage
await FileSystem.create({
  name: 'app-storage',
  encrypted: true,
  performanceMode: 'generalPurpose',
  throughputMode: 'bursting'
})
```

## CDN (CloudFront)

### Distribution Configuration

```typescript
import { CDN } from '@stacksjs/cloud'

// Create CDN distribution
await CDN.create({
  origins: [{
    domainName: 'myapp-bucket.s3.amazonaws.com',
    originPath: '/static',
    id: 'S3-static'
  }],
  defaultCacheBehavior: {
    viewerProtocolPolicy: 'redirect-to-https',
    cachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6', // CachingOptimized
    originRequestPolicyId: '88a5eaf4-2fd4-4709-b370-b4c650ea3fcf' // CORS-S3Origin
  },
  priceClass: 'PriceClass_100',
  certificate: 'arn:aws:acm:us-east-1:123456789:certificate/abc123'
})
```

### Cache Invalidation

```typescript
import { CDN } from '@stacksjs/cloud'

// Invalidate specific paths
await CDN.invalidate([
  '/static/*',
  '/index.html',
  '/api/v1/*'
])

// Invalidate everything
await CDN.invalidateAll()
```

## Database

### Aurora Serverless

```typescript
import { Database } from '@stacksjs/cloud'

// Create Aurora Serverless cluster
await Database.createCluster({
  engine: 'aurora-postgresql',
  serverless: true,
  minCapacity: 2,
  maxCapacity: 16,
  autoPause: true,
  autoPauseDelay: 300, // 5 minutes
  secretsManagerArn: 'arn:aws:secretsmanager:...'
})
```

### DynamoDB

```typescript
import { Database } from '@stacksjs/cloud'

// Create DynamoDB table
await Database.createTable({
  tableName: 'sessions',
  partitionKey: { name: 'id', type: 'S' },
  sortKey: { name: 'createdAt', type: 'N' },
  billingMode: 'PAY_PER_REQUEST',
  ttlAttribute: 'expiresAt',
  globalSecondaryIndexes: [{
    name: 'userId-index',
    partitionKey: { name: 'userId', type: 'S' }
  }]
})
```

## Cache (ElastiCache)

```typescript
import { Cache } from '@stacksjs/cloud'

// Create Redis cluster
await Cache.createCluster({
  engine: 'redis',
  engineVersion: '7.0',
  nodeType: 'cache.t3.medium',
  numCacheNodes: 2,
  automaticFailoverEnabled: true,
  transitEncryptionEnabled: true,
  atRestEncryptionEnabled: true
})
```

## Queue (SQS)

```typescript
import { Queue } from '@stacksjs/cloud'

// Create SQS queue
await Queue.create({
  name: 'jobs',
  visibilityTimeout: 30,
  messageRetentionPeriod: 1209600, // 14 days
  deadLetterQueue: {
    name: 'jobs-dlq',
    maxReceiveCount: 5
  }
})

// Create FIFO queue
await Queue.createFifo({
  name: 'orders.fifo',
  contentBasedDeduplication: true
})
```

## Search Engine (OpenSearch)

```typescript
import { SearchEngine } from '@stacksjs/cloud'

// Create OpenSearch domain
await SearchEngine.create({
  domainName: 'myapp-search',
  engineVersion: 'OpenSearch_2.7',
  instanceType: 't3.small.search',
  instanceCount: 2,
  dedicatedMasterEnabled: true,
  zoneAwarenessEnabled: true,
  encryptionAtRest: true
})
```

## AI Services

### Bedrock Integration

```typescript
import { AI } from '@stacksjs/cloud'

// Configure Bedrock access
await AI.configureBedrock({
  modelIds: [
    'anthropic.claude-3-sonnet-20240229-v1:0',
    'amazon.titan-text-express-v1'
  ],
  enableLogging: true
})
```

### Personalize

```typescript
import { AI } from '@stacksjs/cloud'

// Create recommendation engine
await AI.createRecommender({
  name: 'product-recommendations',
  datasetGroup: 'ecommerce',
  recipe: 'aws-user-personalization'
})
```

## Network

### VPC Configuration

```typescript
import { Network } from '@stacksjs/cloud'

// Create VPC
await Network.createVpc({
  name: 'myapp-vpc',
  cidrBlock: '10.0.0.0/16',
  publicSubnets: ['10.0.1.0/24', '10.0.2.0/24'],
  privateSubnets: ['10.0.3.0/24', '10.0.4.0/24'],
  enableNatGateway: true,
  singleNatGateway: false
})
```

### Security Groups

```typescript
import { Network } from '@stacksjs/cloud'

// Create security group
await Network.createSecurityGroup({
  name: 'api-sg',
  vpcId: 'vpc-123456',
  ingressRules: [{
    port: 443,
    protocol: 'tcp',
    cidr: '0.0.0.0/0'
  }],
  egressRules: [{
    port: 0,
    protocol: '-1',
    cidr: '0.0.0.0/0'
  }]
})
```

## DNS (Route 53)

```typescript
import { DNS } from '@stacksjs/cloud'

// Create hosted zone
await DNS.createZone({
  domain: 'example.com'
})

// Add records
await DNS.addRecord({
  zone: 'example.com',
  name: 'api',
  type: 'A',
  alias: {
    dnsName: 'd1234.cloudfront.net',
    hostedZoneId: 'Z2FDTNDATAQYW2'
  }
})

// Add CNAME
await DNS.addRecord({
  zone: 'example.com',
  name: 'www',
  type: 'CNAME',
  value: 'example.com',
  ttl: 300
})
```

## SSL Certificates (ACM)

```typescript
import { Security } from '@stacksjs/cloud'

// Request certificate
const cert = await Security.requestCertificate({
  domain: 'example.com',
  alternativeNames: ['*.example.com', 'api.example.com'],
  validation: 'DNS'
})

// Validate certificate
await Security.validateCertificate(cert.arn)
```

## Permissions (IAM)

```typescript
import { Permissions } from '@stacksjs/cloud'

// Create execution role
await Permissions.createRole({
  name: 'lambda-execution',
  assumeRolePolicy: {
    Service: 'lambda.amazonaws.com'
  },
  policies: [{
    name: 's3-access',
    statements: [{
      effect: 'Allow',
      actions: ['s3:GetObject', 's3:PutObject'],
      resources: ['arn:aws:s3:::myapp-uploads/*']
    }]
  }]
})
```

## Monitoring and Dashboard

### CloudWatch Setup

```typescript
import { Monitoring } from '@stacksjs/cloud'

// Create alarms
await Monitoring.createAlarm({
  name: 'high-error-rate',
  metric: {
    namespace: 'AWS/Lambda',
    metricName: 'Errors',
    dimensions: { FunctionName: 'api-handler' }
  },
  threshold: 10,
  evaluationPeriods: 2,
  comparisonOperator: 'GreaterThanThreshold',
  actions: ['arn:aws:sns:us-east-1:123456:alerts']
})

// Create dashboard
await Monitoring.createDashboard({
  name: 'application-metrics',
  widgets: [{
    type: 'metric',
    title: 'Lambda Invocations',
    metrics: [
      ['AWS/Lambda', 'Invocations', 'FunctionName', 'api-handler']
    ]
  }]
})
```

## Jump Box (Bastion)

```typescript
import { JumpBox } from '@stacksjs/cloud'

// Create bastion host for secure access
await JumpBox.create({
  name: 'bastion',
  instanceType: 't3.micro',
  keyName: 'myapp-key',
  vpcId: 'vpc-123456',
  subnetId: 'subnet-public-1',
  allowedCidrs: ['203.0.113.0/24']
})

// Get connection command
const cmd = await JumpBox.getConnectionCommand('bastion')
// ssh -i myapp-key.pem ec2-user@bastion.example.com
```

## Edge Cases

### Handling Deployment Failures

```typescript
import { Cloud } from '@stacksjs/cloud'

try {
  await Cloud.deploy()
} catch (error) {
  if (error.code === 'ROLLBACK_COMPLETE') {
    // Stack rolled back, check logs
    const logs = await Cloud.getLogs()
    console.error('Deployment failed:', logs)
  }

  // Trigger rollback if needed
  await Cloud.rollback()
}
```

### Cross-Region Deployment

```typescript
import { Cloud } from '@stacksjs/cloud'

// Deploy to multiple regions
await Promise.all([
  Cloud.deploy({ region: 'us-east-1' }),
  Cloud.deploy({ region: 'eu-west-1' }),
  Cloud.deploy({ region: 'ap-southeast-1' })
])
```

### Blue-Green Deployment

```typescript
import { Cloud } from '@stacksjs/cloud'

// Deploy to staging slot
await Cloud.deploy({ slot: 'staging' })

// Verify staging
const healthy = await Cloud.healthCheck('staging')
if (healthy) {
  // Swap slots
  await Cloud.swapSlots('staging', 'production')
}
```

## API Reference

### Cloud Methods

| Method | Description |
|--------|-------------|
| `deploy(options)` | Deploy application |
| `rollback()` | Rollback deployment |
| `status()` | Get deployment status |
| `healthCheck(env)` | Check environment health |
| `getLogs()` | Get deployment logs |

### Compute Methods

| Method | Description |
|--------|-------------|
| `deployFunction(opts)` | Deploy Lambda function |
| `deployEdgeFunction(opts)` | Deploy edge function |
| `updateFunction(name, opts)` | Update function |
| `invokeFunction(name, payload)` | Invoke function |

### Storage Methods

| Method | Description |
|--------|-------------|
| `createBucket(opts)` | Create S3 bucket |
| `setLifecycle(bucket, rules)` | Set lifecycle rules |
| `setBucketPolicy(bucket, policy)` | Set bucket policy |

### CDN Methods

| Method | Description |
|--------|-------------|
| `create(opts)` | Create distribution |
| `update(id, opts)` | Update distribution |
| `invalidate(paths)` | Invalidate cache |
| `invalidateAll()` | Invalidate all |

### Database Methods

| Method | Description |
|--------|-------------|
| `createCluster(opts)` | Create RDS cluster |
| `createTable(opts)` | Create DynamoDB table |
| `snapshot(name)` | Create snapshot |

### Network Methods

| Method | Description |
|--------|-------------|
| `createVpc(opts)` | Create VPC |
| `createSecurityGroup(opts)` | Create security group |
| `createLoadBalancer(opts)` | Create ALB/NLB |
