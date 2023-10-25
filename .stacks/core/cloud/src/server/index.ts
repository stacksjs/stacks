import process from 'node:process'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import type { UpdateCommandOutput } from '@aws-sdk/lib-dynamodb'
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb'

// Bare-bones DynamoDB Client
const dynamodb = new DynamoDBClient()

// Bare-bones document client
const db = DynamoDBDocumentClient.from(dynamodb)

const TABLE_NAME = process.env.TABLE_NAME

if (!TABLE_NAME)
  throw new Error('Expected environment variable `TABLE_NAME` with name of DynamoDB table to store counter in')

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const command = new UpdateCommand({
      TableName: TABLE_NAME,
      UpdateExpression: 'ADD hitCount :increment',
      ExpressionAttributeValues: {
        ':increment': 1,
      },
      Key: {
        counter: 'global',
      },
      ReturnValues: 'ALL_NEW',
    })

    const resp = await db.send(command) as UpdateCommandOutput

    if (resp.Attributes)
      return new Response(resp.Attributes.hitCount)

    else
      return new Response(JSON.stringify(resp))
  },
})

// eslint-disable-next-line no-console
console.log(`Listening on http://localhost:${server.port} ...`)
