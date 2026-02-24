import process from 'node:process'
import { DynamoDBClient } from '@stacksjs/ts-cloud'

const dynamoDbTool: any = await import('@stacksjs/cache').then((m: any) => m.dynamoDbTool)

const client = new DynamoDBClient('us-east-1', {
  endpoint: 'http://localhost:8000',
})

export async function launchServer(): Promise<void> {
  if (!process.env.GITHUB_ACTIONS) {
    await dynamoDbTool.dynamoDb.launch()
  }

  await delay(5000)
  await createStacksTable()
}

// Function to create a delay
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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
