import { dynamoDb } from 'dynamodb-tooling'

const port = 8000

await dynamoDb.launch({
  port,
  additionalArgs: ['-sharedDb'],
})
