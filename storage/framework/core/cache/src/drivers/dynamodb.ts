import { config } from '@stacksjs/config'
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
    const awsAccessKeyId = options.accessKeyId ?? config.cache.drivers?.dynamodb?.key ?? 'dummy'
    const awsSecretAccessKey = options.secretAccessKey ?? config.cache.drivers?.dynamodb?.secret ?? 'dummy'
    const dynamoEndpoint = options.endpoint ?? config.cache.drivers?.dynamodb?.endpoint ?? 'http://localhost:8000'
    const tableName = options.tableName ?? config.cache.drivers?.dynamodb?.table ?? 'stacks'
    const region = options.region ?? config.cache.drivers?.dynamodb?.region ?? 'us-east-1'

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
