/**
 * DynamoDB fixtures: create and drop the `stacks` table a test run needs.
 *
 * There used to be a `launchServer()` here that started a local DynamoDB
 * through `dynamoDbTool` from `@stacksjs/cache`. That export was removed, so
 * the top-level `await import(...)` resolved to `undefined` and the function
 * threw `Cannot read properties of undefined (reading 'dynamoDb')` on every
 * call - for as long as it had been documented (stacksjs/stacks#2581). It is
 * gone rather than repaired: nothing in the framework can start DynamoDB, and
 * a fixture that pretends to is worse than none.
 *
 * Point `AWS_ENDPOINT_URL` at a DynamoDB you started yourself (DynamoDB Local,
 * or a real region) before calling these.
 */
import { DynamoDBClient } from '@stacksjs/ts-cloud'

const client = new DynamoDBClient('us-east-1')

export async function createStacksTable(): Promise<void> {
  try {
    await client.createTable({
      TableName: 'stacks',
      KeySchema: [
        { AttributeName: 'key', KeyType: 'HASH' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'key', AttributeType: 'S' },
      ],
      ProvisionedThroughput: {
        ReadCapacityUnits: 5,
        WriteCapacityUnits: 5,
      },
    })
  }
  catch (err) {
    console.error('Error Creating Table', err)
  }
}

export async function deleteStacksTable(): Promise<void> {
  try {
    await client.deleteTable({
      TableName: 'stacks',
    })
  }
  catch (err) {
    console.error('Error deleting table:', err)
  }
}
