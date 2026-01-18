# Extend Cloud

This guide covers extending Stacks cloud functionality with custom cloud providers, infrastructure configurations, and advanced cloud resources.

## Getting Started

Stacks provides a flexible cloud infrastructure layer that can be extended with custom providers and configurations.

```ts
import { Cloud } from '@stacksjs/cloud'
```

## Custom Cloud Providers

### Creating a Custom Provider

```ts
// cloud/providers/custom-provider.ts
import type { CloudProvider, DeploymentConfig, DeploymentResult } from '@stacksjs/cloud'

export class CustomCloudProvider implements CloudProvider {
  name = 'custom'

  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    // Implementation for custom deployment
    const resources = await this.createResources(config)

    return {
      success: true,
      url: resources.url,
      deploymentId: resources.id,
    }
  }

  async destroy(deploymentId: string): Promise<boolean> {
    // Implementation for destroying resources
    return true
  }

  async getStatus(deploymentId: string): Promise<DeploymentStatus> {
    // Implementation for getting deployment status
    return {
      status: 'running',
      health: 'healthy',
    }
  }

  private async createResources(config: DeploymentConfig) {
    // Custom resource creation logic
    return {
      id: 'deployment-123',
      url: 'https://app.custom-cloud.com',
    }
  }
}
```

### Registering Custom Providers

```ts
// config/cloud.ts
import { CustomCloudProvider } from '../cloud/providers/custom-provider'

export default {
  driver: 'custom',

  providers: {
    custom: new CustomCloudProvider(),
  },

  // Provider-specific configuration
  custom: {
    apiKey: process.env.CUSTOM_CLOUD_API_KEY,
    region: 'us-east-1',
  },
}
```

## Extending AWS Infrastructure

### Custom CDK Constructs

```ts
// cloud/constructs/custom-api.ts
import * as cdk from 'aws-cdk-lib'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs'

export interface CustomApiProps {
  functionName: string
  handler: string
  memorySize?: number
  timeout?: number
}

export class CustomApi extends Construct {
  public readonly api: apigateway.RestApi
  public readonly function: lambda.Function

  constructor(scope: Construct, id: string, props: CustomApiProps) {
    super(scope, id)

    // Create Lambda function
    this.function = new lambda.Function(this, 'Function', {
      functionName: props.functionName,
      runtime: lambda.Runtime.PROVIDED_AL2,
      handler: props.handler,
      code: lambda.Code.fromAsset('./dist'),
      memorySize: props.memorySize || 256,
      timeout: cdk.Duration.seconds(props.timeout || 30),
    })

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'Api', {
      restApiName: `${props.functionName}-api`,
      deployOptions: {
        stageName: 'prod',
      },
    })

    // Add Lambda integration
    const integration = new apigateway.LambdaIntegration(this.function)
    this.api.root.addMethod('ANY', integration)
    this.api.root.addProxy({
      defaultIntegration: integration,
      anyMethod: true,
    })
  }
}
```

### Custom Stack

```ts
// cloud/stacks/custom-stack.ts
import * as cdk from 'aws-cdk-lib'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as sqs from 'aws-cdk-lib/aws-sqs'
import { Construct } from 'constructs'
import { CustomApi } from '../constructs/custom-api'

export interface CustomStackProps extends cdk.StackProps {
  environment: string
  appName: string
}

export class CustomStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CustomStackProps) {
    super(scope, id, props)

    // S3 Bucket for assets
    const bucket = new s3.Bucket(this, 'AssetsBucket', {
      bucketName: `${props.appName}-${props.environment}-assets`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: props.environment === 'production'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    })

    // DynamoDB Table
    const table = new dynamodb.Table(this, 'MainTable', {
      tableName: `${props.appName}-${props.environment}`,
      partitionKey: {
        name: 'pk',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'sk',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecovery: props.environment === 'production',
    })

    // SQS Queue for background jobs
    const queue = new sqs.Queue(this, 'JobsQueue', {
      queueName: `${props.appName}-${props.environment}-jobs`,
      visibilityTimeout: cdk.Duration.seconds(300),
      retentionPeriod: cdk.Duration.days(14),
    })

    // Custom API
    const api = new CustomApi(this, 'Api', {
      functionName: `${props.appName}-${props.environment}-api`,
      handler: 'index.handler',
      memorySize: 512,
      timeout: 30,
    })

    // Grant permissions
    bucket.grantReadWrite(api.function)
    table.grantReadWriteData(api.function)
    queue.grantSendMessages(api.function)

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.api.url,
    })

    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
    })
  }
}
```

### Using Custom Stack

```ts
// cloud/app.ts
import * as cdk from 'aws-cdk-lib'
import { CustomStack } from './stacks/custom-stack'

const app = new cdk.App()

const environment = app.node.tryGetContext('environment') || 'development'

new CustomStack(app, `MyApp-${environment}`, {
  environment,
  appName: 'my-app',
  env: {
    account: process.env.AWS_ACCOUNT_ID,
    region: process.env.AWS_REGION || 'us-east-1',
  },
})

app.synth()
```

## Custom Infrastructure Resources

### Adding Custom Lambda Functions

```ts
// cloud/functions/custom-function.ts
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as events from 'aws-cdk-lib/aws-events'
import * as targets from 'aws-cdk-lib/aws-events-targets'
import { Construct } from 'constructs'

export function addScheduledFunction(
  scope: Construct,
  id: string,
  options: {
    schedule: string // cron expression
    handler: string
    memorySize?: number
  }
) {
  const fn = new lambda.Function(scope, id, {
    runtime: lambda.Runtime.PROVIDED_AL2,
    handler: options.handler,
    code: lambda.Code.fromAsset('./dist/functions'),
    memorySize: options.memorySize || 128,
  })

  // Create scheduled rule
  const rule = new events.Rule(scope, `${id}Rule`, {
    schedule: events.Schedule.expression(options.schedule),
  })

  rule.addTarget(new targets.LambdaFunction(fn))

  return fn
}

// Usage
addScheduledFunction(this, 'DailyCleanup', {
  schedule: 'cron(0 0 * * ? *)', // Every day at midnight
  handler: 'cleanup.handler',
})
```

### Adding Custom Databases

```ts
// cloud/databases/custom-database.ts
import * as rds from 'aws-cdk-lib/aws-rds'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'

export function addRdsDatabase(
  scope: Construct,
  id: string,
  vpc: ec2.IVpc,
  options: {
    instanceType?: string
    engine?: string
    multiAz?: boolean
  }
) {
  const database = new rds.DatabaseInstance(scope, id, {
    engine: rds.DatabaseInstanceEngine.mysql({
      version: rds.MysqlEngineVersion.VER_8_0,
    }),
    instanceType: ec2.InstanceType.of(
      ec2.InstanceClass.T3,
      ec2.InstanceSize.SMALL
    ),
    vpc,
    vpcSubnets: {
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    },
    multiAz: options.multiAz ?? false,
    allocatedStorage: 20,
    maxAllocatedStorage: 100,
    backupRetention: cdk.Duration.days(7),
    deletionProtection: true,
  })

  return database
}
```

### Adding Custom Caching

```ts
// cloud/caching/elasticache.ts
import * as elasticache from 'aws-cdk-lib/aws-elasticache'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Construct } from 'constructs'

export function addRedisCluster(
  scope: Construct,
  id: string,
  vpc: ec2.IVpc,
  options: {
    nodeType?: string
    numCacheNodes?: number
  }
) {
  const subnetGroup = new elasticache.CfnSubnetGroup(scope, `${id}SubnetGroup`, {
    description: 'Subnet group for Redis cluster',
    subnetIds: vpc.privateSubnets.map(subnet => subnet.subnetId),
  })

  const cluster = new elasticache.CfnCacheCluster(scope, id, {
    cacheNodeType: options.nodeType || 'cache.t3.micro',
    engine: 'redis',
    numCacheNodes: options.numCacheNodes || 1,
    cacheSubnetGroupName: subnetGroup.ref,
  })

  return cluster
}
```

## Custom Deployment Hooks

### Pre-Deployment Hooks

```ts
// cloud/hooks/pre-deploy.ts
export async function preDeployHook(context: DeploymentContext): Promise<void> {
  console.log('Running pre-deployment checks...')

  // Run database migrations
  await runMigrations()

  // Validate configuration
  await validateConfig()

  // Backup current state
  await createBackup()

  console.log('Pre-deployment checks complete')
}

async function runMigrations() {
  // Run pending migrations
  const migrations = await getPendingMigrations()

  for (const migration of migrations) {
    console.log(`Running migration: ${migration.name}`)
    await migration.up()
  }
}

async function validateConfig() {
  const requiredEnvVars = [
    'DATABASE_URL',
    'REDIS_URL',
    'AWS_ACCESS_KEY_ID',
  ]

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`)
    }
  }
}

async function createBackup() {
  // Create backup before deployment
  const timestamp = new Date().toISOString()
  console.log(`Creating backup: backup-${timestamp}`)
}
```

### Post-Deployment Hooks

```ts
// cloud/hooks/post-deploy.ts
export async function postDeployHook(context: DeploymentContext): Promise<void> {
  console.log('Running post-deployment tasks...')

  // Clear caches
  await clearCaches()

  // Warm up endpoints
  await warmUp()

  // Notify team
  await notifyDeployment(context)

  console.log('Post-deployment tasks complete')
}

async function clearCaches() {
  // Clear CDN cache
  await cloudfront.createInvalidation({
    DistributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
    InvalidationBatch: {
      Paths: { Quantity: 1, Items: ['/*'] },
      CallerReference: Date.now().toString(),
    },
  })

  // Clear Redis cache
  await redis.flushall()
}

async function warmUp() {
  const endpoints = [
    '/api/health',
    '/api/products',
    '/api/categories',
  ]

  for (const endpoint of endpoints) {
    await fetch(`${process.env.APP_URL}${endpoint}`)
  }
}

async function notifyDeployment(context: DeploymentContext) {
  await sendSlackNotification({
    channel: '#deployments',
    text: `Deployed ${context.version} to ${context.environment}`,
  })
}
```

### Registering Hooks

```ts
// config/cloud.ts
import { preDeployHook } from '../cloud/hooks/pre-deploy'
import { postDeployHook } from '../cloud/hooks/post-deploy'

export default {
  hooks: {
    preDeploy: preDeployHook,
    postDeploy: postDeployHook,

    onError: async (error: Error, context: DeploymentContext) => {
      console.error('Deployment failed:', error)

      // Rollback on failure
      await context.rollback()

      // Notify team
      await sendSlackNotification({
        channel: '#deployments',
        text: `Deployment failed: ${error.message}`,
      })
    },
  },
}
```

## Multi-Region Deployment

### Configuration

```ts
// config/cloud.ts
export default {
  multiRegion: {
    enabled: true,
    primaryRegion: 'us-east-1',
    replicaRegions: ['eu-west-1', 'ap-southeast-1'],
    routing: 'latency', // 'latency' | 'geolocation' | 'weighted'
  },
}
```

### Multi-Region Stack

```ts
// cloud/stacks/multi-region-stack.ts
import * as cdk from 'aws-cdk-lib'
import * as route53 from 'aws-cdk-lib/aws-route53'
import { Construct } from 'constructs'

export class MultiRegionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props)

    const regions = ['us-east-1', 'eu-west-1', 'ap-southeast-1']

    // Create resources in each region
    for (const region of regions) {
      // Resources are created using nested stacks or cross-region references
    }

    // Set up Route53 latency-based routing
    const hostedZone = route53.HostedZone.fromLookup(this, 'Zone', {
      domainName: 'myapp.com',
    })

    // Add latency-based records for each region
  }
}
```

## Error Handling

```ts
try {
  await Cloud.deploy(config)
} catch (error) {
  if (error instanceof CloudProviderError) {
    console.error('Provider error:', error.message)
    // Handle provider-specific errors
  } else if (error instanceof InfrastructureError) {
    console.error('Infrastructure error:', error.message)
    // Handle infrastructure errors
  } else {
    console.error('Unknown error:', error)
  }
}
```

This documentation covers extending Stacks cloud functionality with custom providers and infrastructure configurations. Each example is designed for flexible cloud infrastructure management.
