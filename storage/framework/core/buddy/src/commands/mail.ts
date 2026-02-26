import { log, runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { CLI } from '@stacksjs/clapp'
import { createHash, createHmac, randomBytes } from 'crypto'
import { readFileSync, existsSync } from 'node:fs'

export function mailCommands(buddy: CLI): void {
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
        const { DynamoDBClient } = await import('@stacksjs/ts-cloud')
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

        const { DynamoDBClient } = await import('@stacksjs/ts-cloud')
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

        const { DynamoDBClient } = await import('@stacksjs/ts-cloud')
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
          const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
          const cfn = new AWSCloudFormationClient(process.env.AWS_REGION || 'us-east-1')
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
        // @ts-ignore
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
        const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
        const cfn = new AWSCloudFormationClient(process.env.AWS_REGION || 'us-east-1')
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
            'Authorization': `Basic ${Buffer.from('test@stacksjs.com:test').toString('base64')}`,
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

  buddy
    .command('mail:credentials [email]', 'Show SMTP credentials for email access')
    .action(async (emailAddress?: string) => {
      loadEnvFiles()

      const domain = process.env.APP_DOMAIN || process.env.MAIL_DOMAIN || 'stacksjs.com'
      const mailHost = `mail.${domain}`
      const email = emailAddress || `chris@${domain}`
      const username = email.includes('@') ? email.split('@')[0] : email
      const envKey = `MAIL_PASSWORD_${username.toUpperCase()}`
      const password = process.env[envKey]

      console.log('')
      console.log('==========================================================')
      console.log(`  EMAIL CREDENTIALS — ${email}`)
      console.log('==========================================================')
      console.log('')
      console.log(`  Email:       ${email}`)
      console.log(`  Host:        ${mailHost}`)
      console.log(`  Port:        587`)
      console.log(`  Security:    STARTTLS`)
      console.log(`  Username:    ${username}`)

      if (password) {
        console.log(`  Password:    ${password}`)
      } else {
        console.log(`  Password:    (not set — add ${envKey} to .env.production)`)
      }

      console.log('')
      console.log('==========================================================')
      console.log('')

      process.exit(ExitCode.Success)
    })

  buddy
    .command('mail:logs', 'Show mail server logs from production')
    .option('-n, --lines <count>', 'Number of log lines to show', { default: '50' })
    .option('-f, --follow', 'Follow log output (poll every 5s)')
    .option('--filter <pattern>', 'Filter logs by pattern (e.g. AUTH, LOGIN, error)')
    .action(async (options: { lines?: string; follow?: boolean; filter?: string }) => {
      loadEnvFiles()

      const region = process.env.AWS_REGION || 'us-east-1'
      const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

      try {
        const { EC2Client, SSMClient } = await import('@stacksjs/ts-cloud')
        const ec2 = new EC2Client(region)
        const ssm = new SSMClient(region)

        // Find the production server instance
        log.info('Finding production server...')
        const data = await ec2.describeInstances({
          Filters: [
            { Name: 'tag:Name', Values: [`${appName}-app-production-server`] },
            { Name: 'instance-state-name', Values: ['running'] },
          ],
        })

        const instanceId = data.Reservations?.[0]?.Instances?.[0]?.InstanceId
        if (!instanceId) {
          log.error('No running production server found.')
          log.info(`Looked for instances tagged: ${appName}-app-production-server`)
          process.exit(ExitCode.FatalError)
        }

        log.info(`Found instance: ${instanceId}`)

        const lines = options.lines || '50'
        const filterCmd = options.filter
          ? ` | grep -iE '${options.filter}'`
          : ''

        const fetchLogs = async () => {
          const cmd = `journalctl -u stacks-mail --no-pager -n ${lines} --since "10 minutes ago" 2>&1${filterCmd}`
          const result = await ssm.runShellCommand(instanceId, [cmd], {
            timeoutSeconds: 30,
            maxWaitMs: 30000,
            pollIntervalMs: 2000,
          })

          if (!result.success) {
            log.error(`Failed to fetch logs: ${result.error || 'Unknown error'}`)
            return false
          }

          if (result.output) {
            // Clear and print
            const logLines = result.output.trim().split('\n')
            for (const line of logLines) {
              // Color code different log levels
              if (line.includes('error') || line.includes('Error') || line.includes('AUTH failed')) {
                console.log(`  \x1b[31m${line}\x1b[0m`)
              } else if (line.includes('warning') || line.includes('Warning')) {
                console.log(`  \x1b[33m${line}\x1b[0m`)
              } else if (line.includes('AUTH success') || line.includes('LOGIN completed') || line.includes('authenticated')) {
                console.log(`  \x1b[32m${line}\x1b[0m`)
              } else {
                console.log(`  ${line}`)
              }
            }
          } else {
            console.log('  No log entries found.')
          }

          return true
        }

        console.log('')
        console.log('==========================================================')
        console.log('  MAIL SERVER LOGS')
        console.log('==========================================================')
        console.log('')

        await fetchLogs()

        if (options.follow) {
          console.log('')
          log.info('Following logs (Ctrl+C to stop)...')
          const poll = setInterval(async () => {
            console.log('')
            await fetchLogs()
          }, 5000)

          await new Promise<void>((resolve) => {
            process.on('SIGINT', () => {
              clearInterval(poll)
              resolve()
            })
          })
        }

        console.log('')
        process.exit(ExitCode.Success)
      } catch (error: any) {
        log.error(`Failed to fetch logs: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:status', 'Show mail server status')
    .action(async () => {
      loadEnvFiles()

      const region = process.env.AWS_REGION || 'us-east-1'
      const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

      try {
        const { EC2Client, SSMClient } = await import('@stacksjs/ts-cloud')
        const ec2 = new EC2Client(region)
        const ssm = new SSMClient(region)

        const data = await ec2.describeInstances({
          Filters: [
            { Name: 'tag:Name', Values: [`${appName}-app-production-server`] },
            { Name: 'instance-state-name', Values: ['running'] },
          ],
        })

        const instanceId = data.Reservations?.[0]?.Instances?.[0]?.InstanceId
        if (!instanceId) {
          log.error('No running production server found.')
          process.exit(ExitCode.FatalError)
        }

        const result = await ssm.runShellCommand(instanceId, [
          'echo === Service ===',
          'systemctl status stacks-mail --no-pager 2>&1 | head -15',
          'echo === Ports ===',
          'ss -tlnp 2>&1 | grep -E "(587|465|993|143)" || echo "No mail ports listening"',
          'echo === Memory ===',
          'ps aux | grep -E "(bun|mail)" | grep -v grep | awk \'{print $6/1024 "MB", $11}\'',
        ], {
          timeoutSeconds: 30,
          maxWaitMs: 30000,
          pollIntervalMs: 2000,
        })

        console.log('')
        console.log('==========================================================')
        console.log('  MAIL SERVER STATUS')
        console.log('==========================================================')
        console.log('')

        if (result.success && result.output) {
          for (const line of result.output.trim().split('\n')) {
            console.log(`  ${line}`)
          }
        } else {
          log.error(`Failed: ${result.error}`)
        }

        console.log('')
        process.exit(ExitCode.Success)
      } catch (error: any) {
        log.error(`Failed to get status: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:server', 'Start SMTP relay server')
    .option('--port <port>', 'SMTP port', { default: '587' })
    .action(async (options: { port: string }) => {
      loadEnvFiles()

      const domain = process.env.APP_DOMAIN || process.env.MAIL_DOMAIN || 'stacksjs.com'
      const port = parseInt(options.port)
      const mailboxes = ['chris', 'blake', 'glenn']

      // Build users map from env vars
      const users: Record<string, { password: string; email: string }> = {}
      const generated: string[] = []

      for (const name of mailboxes) {
        const envKey = `MAIL_PASSWORD_${name.toUpperCase()}`
        let password = process.env[envKey]

        if (!password) {
          password = randomBytes(16).toString('base64url')
          generated.push(`${envKey}=${password}`)
        }

        users[name] = { password, email: `${name}@${domain}` }
      }

      if (generated.length > 0) {
        console.log('')
        log.warn('Generated missing passwords. Add these to .env.production:')
        for (const line of generated) {
          console.log(`  ${line}`)
        }
      }

      console.log('')
      console.log('==========================================================')
      console.log('  SMTP RELAY SERVER')
      console.log('==========================================================')
      console.log('')
      console.log(`  Host:        mail.${domain}`)
      console.log(`  Port:        ${port}`)
      console.log(`  Domain:      ${domain}`)
      console.log('')
      console.log('  Mailboxes:')
      for (const [name, user] of Object.entries(users)) {
        console.log(`    ${name} (${user.email})`)
      }
      console.log('')
      console.log('  Relaying through AWS SES')
      console.log('==========================================================')
      console.log('')

      try {
        const { SmtpServer } = await import('../../../cloud/src/imap/smtp-server')
        const server = new SmtpServer({
          port,
          host: '0.0.0.0',
          domain,
          users,
          sentBucket: `stacks-production-email`,
          sentPrefix: 'sent/',
        })

        await server.start()

        // Keep the process alive until SIGINT
        await new Promise<void>((resolve) => {
          process.on('SIGINT', async () => {
            console.log('\nShutting down SMTP server...')
            await server.stop()
            resolve()
          })
        })

        process.exit(0)
      } catch (error: any) {
        log.error(`Failed to start SMTP server: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })
}

/**
 * Load .env.production and ~/.aws/credentials into process.env
 */
function loadEnvFiles(): void {
  const envPath = '.env.production'
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const eq = line.indexOf('=')
      if (eq > 0 && !line.startsWith('#')) {
        const key = line.slice(0, eq).trim()
        const value = line.slice(eq + 1).trim()
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  }

  // Load AWS credentials from ~/.aws/credentials if not in env
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const awsCredsPath = `${home}/.aws/credentials`
    if (existsSync(awsCredsPath)) {
      const credsContent = readFileSync(awsCredsPath, 'utf-8')
      const profile = process.env.AWS_PROFILE || 'default'
      const lines = credsContent.split('\n')
      let inProfile = false
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith('[')) {
          inProfile = trimmed === `[${profile}]`
          continue
        }
        if (inProfile && trimmed.includes('=')) {
          const eq = trimmed.indexOf('=')
          const key = trimmed.slice(0, eq).trim()
          const value = trimmed.slice(eq + 1).trim()
          if (key === 'aws_access_key_id') process.env.AWS_ACCESS_KEY_ID = value
          if (key === 'aws_secret_access_key') process.env.AWS_SECRET_ACCESS_KEY = value
        }
      }
    }
  }
}
