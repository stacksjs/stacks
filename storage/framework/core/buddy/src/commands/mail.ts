import { log, runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { CAC } from 'cac'
import { createHash, randomBytes } from 'crypto'

export function mailCommands(buddy: CAC): void {
  buddy
    .command('mail:user:add <email>', 'Add a mail user')
    .option('--password <password>', 'User password (generated if not provided)')
    .action(async (email: string, options: { password?: string }) => {
      log.info(`Adding mail user: ${email}`)

      try {
        // Generate password if not provided
        const password = options.password || randomBytes(16).toString('base64').replace(/[+/=]/g, '').substring(0, 16)
        const passwordHash = createHash('sha256').update(password).digest('hex')

        // Get the table name from environment or use default
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const tableName = `${appName}-mail-users`

        // Use ts-cloud DynamoDB client
        const { DynamoDBClient } = await import('ts-cloud/aws')
        const dynamodb = new DynamoDBClient(process.env.AWS_REGION || 'us-east-1')

        await dynamodb.putItem({
          TableName: tableName,
          Item: {
            email: { S: email.toLowerCase() },
            passwordHash: { S: passwordHash },
            createdAt: { S: new Date().toISOString() },
          },
        })

        log.success(`User ${email} added successfully!`)
        console.log('')
        console.log('═══════════════════════════════════════════════════════')
        console.log('  MAIL CREDENTIALS')
        console.log('═══════════════════════════════════════════════════════')
        console.log('')
        console.log(`  Email:    ${email}`)
        console.log(`  Password: ${password}`)
        console.log('')
        console.log('  To connect with Mail.app, run:')
        console.log('    buddy mail:proxy')
        console.log('')
        console.log('═══════════════════════════════════════════════════════')
        console.log('')

        if (!options.password) {
          log.warn('Save this password! It will not be shown again.')
        }

        process.exit(ExitCode.Success)
      } catch (error: any) {
        log.error(`Failed to add user: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:user:list', 'List mail users')
    .action(async () => {
      try {
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const tableName = `${appName}-mail-users`

        const { DynamoDBClient } = await import('ts-cloud/aws')
        const dynamodb = new DynamoDBClient(process.env.AWS_REGION || 'us-east-1')

        const result = await dynamodb.scan({ TableName: tableName })

        console.log('')
        console.log('Mail Users:')
        console.log('───────────────────────────────────────')

        if (!result.Items || result.Items.length === 0) {
          console.log('  No users found')
        } else {
          for (const item of result.Items) {
            const email = item.email?.S || 'unknown'
            const createdAt = item.createdAt?.S || 'unknown'
            console.log(`  📧 ${email}`)
            console.log(`     Created: ${createdAt}`)
          }
        }

        console.log('')
        process.exit(ExitCode.Success)
      } catch (error: any) {
        log.error(`Failed to list users: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:user:delete <email>', 'Delete a mail user')
    .action(async (email: string) => {
      try {
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const tableName = `${appName}-mail-users`

        const { DynamoDBClient } = await import('ts-cloud/aws')
        const dynamodb = new DynamoDBClient(process.env.AWS_REGION || 'us-east-1')

        await dynamodb.deleteItem({
          TableName: tableName,
          Key: { email: { S: email.toLowerCase() } },
        })

        log.success(`User ${email} deleted`)
        process.exit(ExitCode.Success)
      } catch (error: any) {
        log.error(`Failed to delete user: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:proxy', 'Start local IMAP proxy for Mail.app')
    .option('--port <port>', 'IMAP proxy port', { default: '1993' })
    .option('--api <url>', 'Mail API URL')
    .action(async (options: { port: string; api?: string }) => {
      log.info('Starting IMAP proxy...')

      try {
        // Get the API URL from CloudFormation outputs if not provided
        let apiUrl = options.api

        if (!apiUrl) {
          const { CloudFormationClient } = await import('ts-cloud/aws')
          const cfn = new CloudFormationClient(process.env.AWS_REGION || 'us-east-1')
          const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
          const stackName = `${appName}-cloud`

          try {
            const result = await cfn.describeStacks({ stackName })
            const outputs = result.Stacks?.[0]?.Outputs || []
            const mailApiOutput = outputs.find((o: any) => o.OutputKey === 'MailApiUrl')
            apiUrl = mailApiOutput?.OutputValue
          } catch (e) {
            // Stack might not exist yet
          }
        }

        if (!apiUrl) {
          log.error('Mail API URL not found. Run `buddy deploy` first to create the mail infrastructure.')
          process.exit(ExitCode.FatalError)
        }

        console.log('')
        console.log('═══════════════════════════════════════════════════════')
        console.log('  IMAP PROXY')
        console.log('═══════════════════════════════════════════════════════')
        console.log('')
        console.log(`  API URL:  ${apiUrl}`)
        console.log(`  Port:     ${options.port}`)
        console.log('')
        console.log('  Configure Mail.app with:')
        console.log('  ─────────────────────────────────────────────────────')
        console.log('  Account Type:     IMAP')
        console.log('  Incoming Server:  localhost')
        console.log(`  Incoming Port:    ${options.port}`)
        console.log('  SSL:              No (local connection)')
        console.log('  Outgoing Server:  localhost')
        console.log(`  Outgoing Port:    ${options.port}`)
        console.log('  Username:         your-email@stacksjs.com')
        console.log('  Password:         your-password')
        console.log('═══════════════════════════════════════════════════════')
        console.log('')

        // Start the proxy
        process.env.MAIL_API_URL = apiUrl
        process.env.IMAP_PORT = options.port

        // Dynamic import of the proxy
        const { ImapProxy } = await import('../../mail-server/src/proxy/imap-proxy')
        const proxy = new ImapProxy(parseInt(options.port), apiUrl)
        await proxy.start()

        // Keep running
        process.on('SIGINT', () => {
          console.log('\nShutting down proxy...')
          proxy.stop()
          process.exit(0)
        })
      } catch (error: any) {
        log.error(`Failed to start proxy: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:test', 'Test mail API connection')
    .action(async () => {
      try {
        const { CloudFormationClient } = await import('ts-cloud/aws')
        const cfn = new CloudFormationClient(process.env.AWS_REGION || 'us-east-1')
        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const stackName = `${appName}-cloud`

        const result = await cfn.describeStacks({ stackName })
        const outputs = result.Stacks?.[0]?.Outputs || []
        const mailApiOutput = outputs.find((o: any) => o.OutputKey === 'MailApiUrl')

        if (!mailApiOutput?.OutputValue) {
          log.error('Mail API not deployed. Run `buddy deploy` first.')
          process.exit(ExitCode.FatalError)
        }

        const apiUrl = mailApiOutput.OutputValue
        log.info(`Testing Mail API at ${apiUrl}`)

        // Test the API
        const response = await fetch(`${apiUrl}/mailboxes`, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from('test@stacksjs.com:test').toString('base64'),
          },
        })

        if (response.status === 401) {
          log.success('Mail API is responding (auth required)')
        } else if (response.ok) {
          log.success('Mail API is working!')
          const data = await response.json()
          console.log('Response:', JSON.stringify(data, null, 2))
        } else {
          log.warn(`Mail API returned status ${response.status}`)
        }

        process.exit(ExitCode.Success)
      } catch (error: any) {
        log.error(`Failed to test API: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })
}
