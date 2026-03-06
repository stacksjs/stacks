import { log, runCommand } from '@stacksjs/cli'
import { ExitCode } from '@stacksjs/types'
import { CLI } from '@stacksjs/clapp'
import { createHash, createHmac, randomBytes } from 'crypto'
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

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
        const proxy = new ImapProxy(Number.parseInt(options.port, 10), apiUrl)
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

        // Find the mail server instance
        log.info('Finding mail server...')
        const data = await ec2.describeInstances({
          Filters: [
            { Name: 'tag:Name', Values: [`${appName}-mail-server`] },
            { Name: 'instance-state-name', Values: ['running'] },
          ],
        })

        const instanceId = data.Reservations?.[0]?.Instances?.[0]?.InstanceId
        if (!instanceId) {
          log.error('No running mail server found.')
          log.info(`Looked for instances tagged: ${appName}-mail-server`)
          process.exit(ExitCode.FatalError)
        }

        log.info(`Found instance: ${instanceId}`)

        const lines = options.lines || '50'
        const sanitizedFilter = options.filter ? options.filter.replace(/[^a-zA-Z0-9_.@\s-]/g, '') : ''
        const filterCmd = sanitizedFilter
          ? ` | grep -iE '${sanitizedFilter}'`
          : ''

        // Check both service names (smtp-server for Zig mode, mail-server for serverless)
        const fetchLogs = async () => {
          const cmd = `journalctl -u smtp-server -u mail-server --no-pager -n ${lines} --since "10 minutes ago" 2>&1${filterCmd}`
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
          let polling = false
          const poll = setInterval(() => {
            if (polling) return
            polling = true
            console.log('')
            fetchLogs()
              .catch(e => log.error('Log polling failed:', e))
              .finally(() => { polling = false })
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
            { Name: 'tag:Name', Values: [`${appName}-mail-server`] },
            { Name: 'instance-state-name', Values: ['running'] },
          ],
        })

        const instanceId = data.Reservations?.[0]?.Instances?.[0]?.InstanceId
        if (!instanceId) {
          log.error('No running mail server found.')
          log.info(`Looked for instances tagged: ${appName}-mail-server`)
          process.exit(ExitCode.FatalError)
        }

        const result = await ssm.runShellCommand(instanceId, [
          'echo === Service ===',
          '(systemctl status smtp-server --no-pager 2>&1 || systemctl status mail-server --no-pager 2>&1) | head -15',
          'echo === Ports ===',
          'ss -tlnp 2>&1 | grep -E "(25|587|465|993|143|110|995)" || echo "No mail ports listening"',
          'echo === Memory ===',
          'ps aux | grep -E "(smtp-server|bun|mail)" | grep -v grep | awk \'{print $6/1024 "MB", $11}\'',
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
    .command('mail:port25:request', 'Request port 25 unblock for direct SMTP delivery')
    .option('--provider <provider>', 'Cloud provider: aws or hetzner', { default: 'aws' })
    .option('--instance-id <id>', 'AWS EC2 instance ID (auto-detected if not provided)')
    .option('--server-id <id>', 'Hetzner server ID (auto-detected if not provided)')
    .option('--elastic-ip <ip>', 'AWS Elastic IP address')
    .option('--rdns <hostname>', 'Reverse DNS hostname (e.g. mail.stacksjs.com)')
    .option('--use-case <text>', 'Description of email use case')
    .action(async (options: {
      provider: string
      instanceId?: string
      serverId?: string
      elasticIp?: string
      rdns?: string
      useCase?: string
    }) => {
      loadEnvFiles()

      const domain = process.env.APP_DOMAIN || process.env.MAIL_DOMAIN || 'stacksjs.com'
      const provider = options.provider.toLowerCase()

      if (provider === 'aws') {
        await requestAwsPort25(options, domain)
      } else if (provider === 'hetzner') {
        await requestHetznerPort25(options, domain)
      } else {
        log.error(`Unknown provider: ${provider}. Use 'aws' or 'hetzner'.`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:port25:status', 'Check outbound port 25 status on the mail server')
    .option('--provider <provider>', 'Cloud provider: aws or hetzner', { default: 'aws' })
    .action(async (options: { provider: string }) => {
      loadEnvFiles()

      const region = process.env.AWS_REGION || 'us-east-1'
      const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

      if (options.provider === 'hetzner') {
        // For Hetzner, SSH directly
        const hetznerToken = process.env.HETZNER_API_TOKEN
        if (!hetznerToken) {
          log.error('HETZNER_API_TOKEN not set')
          process.exit(ExitCode.FatalError)
        }

        try {
          // Find server IP
          const res = await fetch('https://api.hetzner.cloud/v1/servers?label_selector=service=mail', {
            headers: { Authorization: `Bearer ${hetznerToken}` },
          })
          const data = await res.json() as any
          const server = data.servers?.[0]
          const ip = server?.public_net?.ipv4?.ip

          if (!ip) {
            // Try listing all servers
            const allRes = await fetch('https://api.hetzner.cloud/v1/servers', {
              headers: { Authorization: `Bearer ${hetznerToken}` },
            })
            const allData = await allRes.json() as any
            const mailServer = allData.servers?.find((s: any) => s.name?.includes('mail'))
            if (mailServer) {
              const serverIp = mailServer.public_net?.ipv4?.ip
              log.info(`Found Hetzner server: ${mailServer.name} (${serverIp})`)
              const result = execSync(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${serverIp} "timeout 5 bash -c 'echo QUIT > /dev/tcp/gmail-smtp-in.l.google.com/25' 2>&1 && echo PORT_25_OPEN || echo PORT_25_BLOCKED"`, { encoding: 'utf-8' })
              printPort25Status(result.trim(), 'Hetzner', serverIp)
            } else {
              log.error('No mail server found on Hetzner')
            }
          } else {
            const result = execSync(`ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${ip} "timeout 5 bash -c 'echo QUIT > /dev/tcp/gmail-smtp-in.l.google.com/25' 2>&1 && echo PORT_25_OPEN || echo PORT_25_BLOCKED"`, { encoding: 'utf-8' })
            printPort25Status(result.trim(), 'Hetzner', ip)
          }
        } catch (error: any) {
          log.error(`Failed: ${error.message}`)
        }
        process.exit(ExitCode.Success)
      }

      // AWS: use SSM to test
      try {
        const { EC2Client, SSMClient } = await import('@stacksjs/ts-cloud')
        const ec2 = new EC2Client(region)
        const ssm = new SSMClient(region)

        const data = await ec2.describeInstances({
          Filters: [
            { Name: 'tag:Name', Values: [`${appName}-mail-server`] },
            { Name: 'instance-state-name', Values: ['running'] },
          ],
        })

        const instance = data.Reservations?.[0]?.Instances?.[0]
        const instanceId = instance?.InstanceId
        if (!instanceId) {
          log.error('No running mail server found.')
          process.exit(ExitCode.FatalError)
        }

        const publicIp = instance?.PublicIpAddress || 'unknown'
        log.info(`Testing port 25 on ${instanceId} (${publicIp})...`)

        const result = await ssm.runShellCommand(instanceId, [
          'timeout 5 bash -c "echo QUIT > /dev/tcp/gmail-smtp-in.l.google.com/25" 2>&1 && echo PORT_25_OPEN || echo PORT_25_BLOCKED',
        ], { timeoutSeconds: 15, maxWaitMs: 20000, pollIntervalMs: 2000 })

        printPort25Status(result.output?.trim() || 'PORT_25_BLOCKED', 'AWS', publicIp)
        process.exit(ExitCode.Success)
      } catch (error: any) {
        log.error(`Failed: ${error.message}`)
        process.exit(ExitCode.FatalError)
      }
    })

  buddy
    .command('mail:server', 'Start SMTP relay server')
    .option('--port <port>', 'SMTP port', { default: '587' })
    .action(async (options: { port: string }) => {
      loadEnvFiles()

      const domain = process.env.APP_DOMAIN || process.env.MAIL_DOMAIN || 'stacksjs.com'
      const port = Number.parseInt(options.port, 10)
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

function printPort25Status(result: string, provider: string, ip: string): void {
  console.log('')
  console.log('==========================================================')
  console.log('  PORT 25 STATUS')
  console.log('==========================================================')
  console.log('')
  console.log(`  Provider:  ${provider}`)
  console.log(`  Server IP: ${ip}`)

  if (result.includes('PORT_25_OPEN')) {
    console.log(`  Port 25:   \x1b[32mOPEN\x1b[0m`)
    console.log('')
    console.log('  Direct SMTP delivery is available!')
    console.log('  Set SMTP_DELIVERY_METHOD=direct in your server env.')
  } else {
    console.log(`  Port 25:   \x1b[31mBLOCKED\x1b[0m`)
    console.log('')
    console.log(`  Run: buddy mail:port25:request --provider ${provider.toLowerCase()}`)
  }

  console.log('')
  console.log('==========================================================')
  console.log('')
}

/**
 * Request AWS to remove EC2 port 25 restriction.
 *
 * AWS requires this via their web form or Support API (Business plan+).
 * We try the Support API first, then fall back to opening the web form.
 */
async function requestAwsPort25(
  options: { instanceId?: string; elasticIp?: string; rdns?: string; useCase?: string },
  domain: string,
): Promise<void> {
  const region = process.env.AWS_REGION || 'us-east-1'
  const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

  // Auto-detect instance ID and Elastic IP if not provided
  let instanceId = options.instanceId
  let elasticIp = options.elasticIp

  if (!instanceId || !elasticIp) {
    try {
      const { EC2Client } = await import('@stacksjs/ts-cloud')
      const ec2 = new EC2Client(region)
      const data = await ec2.describeInstances({
        Filters: [
          { Name: 'tag:Name', Values: [`${appName}-mail-server`] },
          { Name: 'instance-state-name', Values: ['running'] },
        ],
      })

      const instance = data.Reservations?.[0]?.Instances?.[0]
      if (instance) {
        instanceId = instanceId || instance.InstanceId
        elasticIp = elasticIp || instance.PublicIpAddress
      }
    } catch {
      // Continue without auto-detection
    }
  }

  const rdns = options.rdns || `mail.${domain}`
  const useCase = options.useCase || [
    `We run a self-hosted mail server (mail.${domain}) for our organization.`,
    'We send transactional emails (account notifications, password resets) and',
    'occasional team communication. Expected volume: <1000 emails/day.',
    'We have SPF, DKIM, and DMARC configured. We need outbound port 25',
    'to deliver email directly to recipient mail servers via MX records.',
  ].join(' ')

  console.log('')
  console.log('==========================================================')
  console.log('  AWS PORT 25 UNBLOCK REQUEST')
  console.log('==========================================================')
  console.log('')
  console.log(`  Instance:    ${instanceId || '(not detected)'}`)
  console.log(`  Elastic IP:  ${elasticIp || '(not detected)'}`)
  console.log(`  Reverse DNS: ${rdns}`)
  console.log(`  Region:      ${region}`)
  console.log('')

  // Try Support API first (requires Business/Enterprise support plan)
  try {
    const result = execSync(
      `aws support create-case \
        --subject "Request to remove email sending limitations" \
        --communication-body "${useCase}\n\nElastic IP: ${elasticIp || 'N/A'}\nInstance ID: ${instanceId || 'N/A'}\nReverse DNS: ${rdns}\nRegion: ${region}" \
        --service-code "amazon-ec2" \
        --category-code "port-25-throttle" \
        --severity-code "normal" \
        --cc-email-addresses "" \
        --language "en" \
        --region us-east-1 2>&1`,
      { encoding: 'utf-8' },
    )

    if (result.includes('caseId')) {
      try {
        const caseId = JSON.parse(result).caseId
        log.success(`Support case created: ${caseId}`)
        log.info('')
        log.info('  AWS will process this within 24-48 hours.')
        log.info('  Check status: aws support describe-cases --region us-east-1')
        log.info('')
        process.exit(ExitCode.Success)
      }
      catch {
        log.error('Failed to parse AWS support case response')
      }
    }
  } catch {
    // Support API not available (no Business plan) — fall back to web form
  }

  // Also set up Reverse DNS via the EC2 API (this is separate and always available)
  if (elasticIp) {
    log.info('Setting up reverse DNS (rDNS) for Elastic IP...')
    try {
      // First, get the allocation ID for the Elastic IP
      const allocResult = execSync(
        `aws ec2 describe-addresses --public-ips ${elasticIp} --region ${region} --query 'Addresses[0].AllocationId' --output text 2>&1`,
        { encoding: 'utf-8' },
      ).trim()

      if (allocResult && !allocResult.includes('error')) {
        // Request rDNS update
        execSync(
          `aws ec2 modify-address-attribute --allocation-id ${allocResult} --domain-name ${rdns} --region ${region} 2>&1`,
          { encoding: 'utf-8' },
        )
        log.success(`Reverse DNS requested: ${elasticIp} -> ${rdns}`)
        console.log('  (rDNS propagation may take a few minutes)')
      }
    } catch (error: any) {
      log.warn(`rDNS setup failed: ${error.message}`)
      console.log('  You may need to set this up manually in the AWS console.')
    }
  }

  // Fall back to web form
  console.log('')
  console.log('  The Support API requires a Business or Enterprise support plan.')
  console.log('  Opening the AWS web form instead...')
  console.log('')
  console.log('  Fill in these details:')
  console.log('  ──────────────────────────────────────────────────────')
  console.log(`  Email address:    admin@${domain}`)
  console.log(`  Use case:         Sending outbound email from self-hosted mail server`)
  console.log(`  Elastic IP:       ${elasticIp || '(enter your Elastic IP)'}`)
  console.log(`  rDNS:             ${rdns}`)
  console.log(`  Region:           ${region}`)
  console.log('  ──────────────────────────────────────────────────────')
  console.log('')

  const formUrl = 'https://console.aws.amazon.com/support/contacts#/rdns-limits'
  try {
    execSync(`open "${formUrl}" 2>/dev/null || xdg-open "${formUrl}" 2>/dev/null || echo ""`, { encoding: 'utf-8' })
    log.info(`Opened: ${formUrl}`)
  } catch {
    console.log(`  Open this URL in your browser:`)
    console.log(`  ${formUrl}`)
  }

  console.log('')
  console.log('  After AWS approves (24-48 hours), verify with:')
  console.log('    buddy mail:port25:status')
  console.log('')

  process.exit(ExitCode.Success)
}

/**
 * Request Hetzner to unblock port 25.
 *
 * Uses Hetzner Robot API to create a support request.
 */
async function requestHetznerPort25(
  options: { serverId?: string; rdns?: string; useCase?: string },
  domain: string,
): Promise<void> {
  const hetznerToken = process.env.HETZNER_API_TOKEN
  if (!hetznerToken) {
    log.error('HETZNER_API_TOKEN not set. Add it to .env or set it as an environment variable.')
    process.exit(ExitCode.FatalError)
  }

  // Auto-detect server
  let serverId = options.serverId
  let serverIp = ''
  let serverName = ''

  try {
    const res = await fetch('https://api.hetzner.cloud/v1/servers', {
      headers: { Authorization: `Bearer ${hetznerToken}` },
    })
    const data = await res.json() as any
    const mailServer = data.servers?.find((s: any) => s.name?.includes('mail'))
      || data.servers?.[0]

    if (mailServer) {
      serverId = serverId || String(mailServer.id)
      serverIp = mailServer.public_net?.ipv4?.ip || ''
      serverName = mailServer.name || ''
    }
  } catch {
    // Continue without auto-detection
  }

  const rdns = options.rdns || `mail.${domain}`
  const useCase = options.useCase || [
    `Self-hosted mail server for ${domain}.`,
    'Transactional + team email, <1000 emails/day.',
    'SPF/DKIM/DMARC configured.',
  ].join(' ')

  console.log('')
  console.log('==========================================================')
  console.log('  HETZNER PORT 25 UNBLOCK REQUEST')
  console.log('==========================================================')
  console.log('')
  console.log(`  Server:     ${serverName} (ID: ${serverId || 'unknown'})`)
  console.log(`  Server IP:  ${serverIp || '(not detected)'}`)
  console.log(`  rDNS:       ${rdns}`)
  console.log('')

  // Step 1: Set reverse DNS on the server IP
  if (serverId && serverIp) {
    log.info('Setting reverse DNS...')
    try {
      const rdnsRes = await fetch(
        `https://api.hetzner.cloud/v1/servers/${serverId}/actions/change_dns_ptr`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hetznerToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ip: serverIp, dns_ptr: rdns }),
        },
      )
      const rdnsData = await rdnsRes.json() as any

      if (rdnsData.action?.status === 'running' || rdnsData.action?.status === 'success') {
        log.success(`Reverse DNS set: ${serverIp} -> ${rdns}`)
      } else {
        log.warn(`rDNS response: ${JSON.stringify(rdnsData.error || rdnsData)}`)
      }
    } catch (error: any) {
      log.warn(`rDNS failed: ${error.message}`)
    }
  }

  // Step 2: Hetzner doesn't have a public API for port 25 unblock requests.
  // The user needs to submit via the Hetzner Cloud Console or Robot.
  console.log('')
  console.log('  To request port 25 unblock from Hetzner:')
  console.log('  ──────────────────────────────────────────────────────')
  console.log('  1. Log in to https://console.hetzner.cloud')
  console.log(`  2. Select project containing server "${serverName}"`)
  console.log('  3. Go to Support (left sidebar) -> New support request')
  console.log('  4. Use this template:')
  console.log('')
  console.log('     Subject: Request to unblock outbound port 25 (SMTP)')
  console.log('')
  console.log('     Body:')
  console.log('     ─────')
  console.log(`     Server: ${serverName} (ID: ${serverId}, IP: ${serverIp})`)
  console.log(`     Use case: ${useCase}`)
  console.log(`     Reverse DNS: ${serverIp} -> ${rdns}`)
  console.log('     We comply with all anti-spam regulations (CAN-SPAM, GDPR).')
  console.log('     Please unblock outbound ports 25 and 465 for this server.')
  console.log('     ─────')
  console.log('')
  console.log('  ──────────────────────────────────────────────────────')

  // Try to open the console
  const consoleUrl = 'https://console.hetzner.cloud'
  try {
    execSync(`open "${consoleUrl}" 2>/dev/null || xdg-open "${consoleUrl}" 2>/dev/null || echo ""`, { encoding: 'utf-8' })
    log.info(`Opened: ${consoleUrl}`)
  } catch {
    console.log(`  Open: ${consoleUrl}`)
  }

  console.log('')
  console.log('  After Hetzner approves, verify with:')
  console.log('    buddy mail:port25:status --provider hetzner')
  console.log('')

  process.exit(ExitCode.Success)
}
