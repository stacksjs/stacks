import { dynamoDb } from 'dynamodb-tooling'

const port = 8000

dynamoDb.launch({
  port,
  additionalArgs: ['-sharedDb'],
})
