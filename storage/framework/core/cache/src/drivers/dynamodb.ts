import type { PutItemCommandInput } from '@aws-sdk/client-dynamodb'
import { DynamoDB, ListTablesCommand } from '@aws-sdk/client-dynamodb'
import { cache } from '@stacksjs/config'

type CacheDriver = {
  createTable: () => Promise<void>
  set: (key: string, value: string | number) => Promise<void>
  get: (key: string) => Promise<string | undefined | null>
  remove: (key: string) => Promise<void>
  del: (key: string) => Promise<void>
  client: DynamoDB
}

const valueAttribute = 'value'
const keyAttribute = 'key'
const tableName = cache.drivers?.dynamodb?.table

const client = new DynamoDB({ region: cache.drivers?.dynamodb?.region })

function getValueType(value: string | number) {
  if (typeof value === 'string') return 'S'
  if (typeof value === 'number') return 'N'
  return 'S'
}

function serialize(value: string | number) {
  return String(value)
}

export const dynamodb: CacheDriver = {
  async createTable() {
    const tables = await client.send(new ListTablesCommand({}))

    const tableExists = tables.TableNames?.includes('cache')

    if (tableExists) return

    const params = {
      AttributeDefinitions: [
        {
          AttributeName: 'key',
          AttributeType: 'S',
        },
      ],
      KeySchema: [
        {
          AttributeName: 'key',
          KeyType: 'HASH',
        },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
      TableName: tableName,
    }

    client.createTable(params)
  },

  async set(key: string, value: string | number): Promise<void> {
    const params: PutItemCommandInput = {
      TableName: tableName,
      Item: {
        [keyAttribute]: {
          S: key,
        },
        [valueAttribute]: {
          [getValueType(value)]: serialize(value),
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

    return response.Item[valueAttribute].S ?? response.Item[valueAttribute].N
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
