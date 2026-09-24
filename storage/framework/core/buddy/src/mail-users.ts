import type { DynamoDBClient } from '@stacksjs/ts-cloud'
import type { MailboxUserBackend } from '@stacksjs/types'
import { createHash } from 'node:crypto'

type MailUserClient = Pick<DynamoDBClient, 'putItem' | 'scan' | 'deleteItem'>
type ClientFactory = (region: string) => Promise<MailUserClient>

export function resolveMailUserBackend(settings?: MailboxUserBackend): { table: string, region: string } {
  if (settings?.driver !== 'dynamodb')
    throw new Error('mail:user:* requires config/email.ts server.mailboxUsers with driver: "dynamodb" and the existing verifier table. For SQLite or external mail servers, manage users through that server or its deployment configuration; this command does not modify them.')
  if (typeof settings.table !== 'string' || !/^[a-z0-9_.-]{3,255}$/i.test(settings.table))
    throw new Error('server.mailboxUsers.table must name the existing DynamoDB mailbox verifier table.')
  return { table: settings.table, region: settings.region || process.env.AWS_REGION || 'us-east-1' }
}

const defaultClient: ClientFactory = async (region) => {
  const { DynamoDBClient } = await import('@stacksjs/ts-cloud')
  return new DynamoDBClient(region)
}

export async function mailUserClient(settings?: MailboxUserBackend, factory: ClientFactory = defaultClient) {
  const { table, region } = resolveMailUserBackend(settings)
  return { client: await factory(region), table }
}

export function parseMailUserPassword(input: string): string {
  const password = input.replace(/\r?\n$/, '')
  if (!password || password.length > 1024 || /[\r\n\0]/.test(password))
    throw new Error('Provide one non-empty password (at most 1024 characters) through --password-stdin.')
  return password
}

export async function addMailUser(email: string, input: string, settings?: MailboxUserBackend, factory: ClientFactory = defaultClient): Promise<void> {
  if (!/^[^\s@]+@[^\s@]+$/.test(email))
    throw new Error('Provide a valid mailbox email address.')
  const password = parseMailUserPassword(input)
  const { client, table } = await mailUserClient(settings, factory)
  await client.putItem({
    TableName: table,
    Item: {
      email: { S: email.toLowerCase() },
      passwordHash: { S: createHash('sha256').update(password).digest('hex') },
      createdAt: { S: new Date().toISOString() },
    },
  })
}
