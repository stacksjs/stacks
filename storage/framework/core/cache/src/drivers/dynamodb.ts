// dynamodb-cache-driver.ts
import { BentoCache, bentostore } from 'bentocache'
import { dynamoDbDriver } from 'bentocache/drivers/dynamodb'
import { BaseCacheDriver } from './base'

export interface DynamoDBOptions {
  endpoint?: string
  region?: string
  tableName?: string
  accessKeyId?: string
  secretAccessKey?: string
}

export class DynamoDBCacheDriver extends BaseCacheDriver {
  constructor(options: DynamoDBOptions = {}) {
    // Use environment variables with fallbacks
    const awsAccessKeyId = options.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID ?? 'dummy'
    const awsSecretAccessKey = options.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY ?? 'dummy'
    const dynamoEndpoint = options.endpoint ?? process.env.AWS_DYNAMODB_ENDPOINT ?? 'http://localhost:8000'
    const tableName = options.tableName ?? process.env.AWS_DYNAMODB_TABLE ?? 'stacks'
    const region = options.region ?? process.env.AWS_REGION ?? 'us-east-1'

    const client = new BentoCache({
      default: 'dynamo',
      stores: {
        dynamo: bentostore().useL2Layer(
          dynamoDbDriver({
            endpoint: dynamoEndpoint,
            region,
            table: {
              name: tableName,
            },
            credentials: {
              accessKeyId: awsAccessKeyId,
              secretAccessKey: awsSecretAccessKey,
            },
          }),
        ),
      },
    })
    
    super(client)
  }
}

export const dynamodb: DynamoDBCacheDriver = new DynamoDBCacheDriver()