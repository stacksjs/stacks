import { dynamoDb } from '@stacksjs/cache'

import { CreateTableCommand, DynamoDBClient, KeyType, ScalarAttributeType } from '@aws-sdk/client-dynamodb'

const client = new DynamoDBClient({ endpoint: 'http://localhost:8000' })

export async function launch(): Promise<void> {
  await dynamoDb.launch()
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
    const data = await client.send(new CreateTableCommand(params))
    console.log('Table created successfully:', data)
  } catch (err) {
    console.error('Error creating table:', err)
  }
}
