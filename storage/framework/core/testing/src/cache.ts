import { dynamoDb } from '@stacksjs/cache'

async function launch(): Promise<void> {
  await dynamoDb.launch()
}

await launch()
