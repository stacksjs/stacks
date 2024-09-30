import { dynamoDb } from 'dynamodb-tooling'

async function launch(): Promise<void> {
  await dynamoDb.launch()
}

await launch()
