import type { DynamoDB  } from '@aws-sdk/client-dynamodb'

export type CacheDriver = {
  createTable: () => Promise<void>
  set: (key: string, value: string | number) => Promise<void>
  get: (key: string) => Promise<string | undefined | null>
  remove: (key: string) => Promise<void>
  del: (key: string) => Promise<void>
  client: DynamoDB
}
