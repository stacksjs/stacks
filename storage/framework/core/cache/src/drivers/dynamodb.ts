import type { KeyType, PutItemCommandInput, ScalarAttributeType } from '@aws-sdk/client-dynamodb'
import { DynamoDB, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { cache } from '@stacksjs/config'
import type { CacheDriver } from './type'

const valueAttribute = 'value'
const keyAttribute = 'key'
const tableName = cache.drivers?.dynamodb?.table

const client = new DynamoDB({ region: cache.drivers?.dynamodb?.region })

export const dynamodb: CacheDriver = {
  async createTable() {
    const tables = await client.send(new ListTablesCommand({}))

    const tableExists = tables.TableNames?.includes('cache')

    if (tableExists) return

    const params = {
      AttributeDefinitions: [
        {
          AttributeName: 'key',
          AttributeType: 'S' as ScalarAttributeType, // Use 'as const' to specify the type
        },
      ],
      KeySchema: [
        {
          AttributeName: 'key',
          KeyType: 'HASH' as KeyType,
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
      TableName: tableName,
    }

    await client.createTable(params)
  },

  async set(key: string, value: string): Promise<void> {
    const params: PutItemCommandInput = {
      TableName: tableName,
      Item: {
        [key]: {
          S: value,
        },
      },
    }

    await client.putItem(params)
  },

  async get(key: string): Promise<string | undefined | null> {
    const params = {
      TableName: tableName,
      Key: {
        [keyAttribute]: {
          S: key,
        },
      },
    }

    const response = await client.getItem(params)

    if (!response.Item) return null

    return response.Item[valueAttribute]?.S
  },

  async remove(key: string): Promise<void> {
    const params = {
      TableName: tableName,
      Key: {
        [keyAttribute]: {
          S: key,
        },
      },
    }

    await client.deleteItem(params)
  },

  del(key: string): Promise<void> {
    return this.remove(key)
  },

  client,
}
