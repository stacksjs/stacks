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
    const awsAccessKeyId = options.accessKeyId ?? 'dummy'
    const awsSecretAccessKey = options.secretAccessKey ?? 'dummy'
    const dynamoEndpoint = options.endpoint ?? 'http://localhost:8000'
    const tableName = options.tableName ?? 'stacks'
    const region = options.region ?? 'us-east-1'

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
