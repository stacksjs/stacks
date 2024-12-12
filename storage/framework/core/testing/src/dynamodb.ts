import process from 'node:process'
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
  KeyType,
  ScalarAttributeType,
} from '@aws-sdk/client-dynamodb'

import { dynamoDbTool } from '@stacksjs/cache'

const client = new DynamoDBClient({
  endpoint: 'http://localhost:8000',
  region: 'us-east-1', // You can use any valid region name
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy',
  },
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
  const params = {
    TableName: 'stacks',
    KeySchema: [
      { AttributeName: 'key', KeyType: KeyType.HASH }, // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: 'key', AttributeType: ScalarAttributeType.S }, // S for String
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
  }

  try {
    await client.send(new CreateTableCommand(params))
  }
  catch (err) {
    console.error('Error Creating Table', err)
  }
}

export async function deleteStacksTable(): Promise<void> {
  const params = {
    TableName: 'stacks',
  }

  try {
    await client.send(new DeleteTableCommand(params))
  }
  catch (err) {
    console.error('Error deleting table:', err)
  }
}
