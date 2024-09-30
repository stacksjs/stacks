import { BentoCache, bentostore } from 'bentocache'
import { dynamoDbDriver } from 'bentocache/drivers/dynamodb'
import type { CacheDriver } from './type'

const awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID || ''
const awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || ''
const dynamoEndpoint = process.env.AWS_DYNAMODB_ENDPOINT || 'http://localhost:8000'
const tableName = process.env.AWS_DYNAMODB_TABLE || 'stacks'
const region = process.env.AWS_REGION || 'us-east-1'

const client = new BentoCache({
  default: 'dynamo',
  stores: {
    dynamo: bentostore().useL2Layer(
      dynamoDbDriver({
        endpoint: dynamoEndpoint,
        region: 'eu-east-1',
        table: {
          name: 'stacks',
        },
      }),
    ),
  },
})

export const dynamodb: CacheDriver = {
  async set(key: string, value: string, ttl?: number): Promise<void> {
    await client.set({
      key,
      value,
      gracePeriod: { enabled: true, duration: '5m' },
    })
  },
  async setForever(key: string, value: string, ttl?: number): Promise<void> {
    await client.setForever({
      key,
      value,
    })
  },
  async get(key: string): Promise<string | undefined | null> {
    const items = await client.get<string>(key)

    return items
  },
  async getOrSet(key: string, value: string): Promise<string | undefined | null> {
    const items = await client.getOrSet(key, () => value)

    return items
  },
  async del(key: string): Promise<void> {
    await client.delete({ key })
  },
  async deleteMany(keys: string[]): Promise<void> {
    await client.deleteMany({ keys })
  },
  async remove(key: string): Promise<void> {
    await client.delete({ key })
  },
  async has(key: string): Promise<boolean> {
    return await client.has({ key })
  },
  async missing(key: string): Promise<boolean> {
    return await client.missing({ key })
  },
  async deleteAll(): Promise<void> {
    await client.clear()
  },
  async clear(): Promise<void> {
    await client.clear()
  },
  async disconnect(): Promise<void> {
    await client.disconnect()
  },
  client,
}
