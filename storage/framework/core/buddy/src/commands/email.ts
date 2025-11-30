import type { CLI } from '@stacksjs/types'
import { readFileSync, existsSync } from 'node:fs'
import { email as emailConfig } from '@stacksjs/config'

// Load AWS credentials from .env.production
function loadAwsCredentials(): void {
  const envPath = '.env.production'
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const eq = line.indexOf('=')
      if (eq > 0 && !line.startsWith('#')) {
        process.env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim()
      }
    }
  }
}

const descriptions = {
  email: 'Email server management commands',
  verify: 'Check domain verification status',
  test: 'Send a test email',
  list: 'List configured mailboxes',
  logs: 'View email processing logs',
  status: 'Show email server status',
}

export function email(buddy: CLI): void {
  buddy
    .command('email', descriptions.email)
    .alias('mail')
    .action(async () => {
      console.log('\n📧 Email Server Commands\n')
      console.log('  buddy email:verify    - Check domain verification status')
      console.log('  buddy email:test      - Send a test email')
      console.log('  buddy email:list      - List configured mailboxes')
      console.log('  buddy email:logs      - View email processing logs')
      console.log('  buddy email:status    - Show email server status')
      console.log('')
    })

  buddy
    .command('email:verify', descriptions.verify)
    .action(async () => {
      console.log('\n📧 Checking Email Domain Verification...\n')
      loadAwsCredentials()

      try {
        const { SESClient } = await import('ts-cloud/aws')
        const ses = new SESClient(process.env.AWS_REGION || 'us-east-1')

        const emailDomain = emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'
        console.log(`Domain: ${emailDomain}`)

        const identity = await ses.getEmailIdentity(emailDomain)

        if (identity) {
          console.log(`\n✅ Domain Status: ${identity.VerificationStatus || 'Unknown'}`)

          if (identity.DkimAttributes) {
            console.log(`\nDKIM Status: ${identity.DkimAttributes.Status || 'Unknown'}`)
            if (identity.DkimAttributes.Tokens) {
              console.log('\nDKIM Records needed:')
              for (const token of identity.DkimAttributes.Tokens) {
                console.log(`  CNAME: ${token}._domainkey.${emailDomain}`)
                console.log(`  Value: ${token}.dkim.amazonses.com`)
              }
            }
          }
        }
        else {
          console.log('\n⚠️  Domain not found in SES. Run `buddy deploy` to set up email.')
        }
      }
      catch (error: any) {
        console.error('\n❌ Error checking verification:', error.message)
      }
    })

  buddy
    .command('email:test [recipient]', descriptions.test)
    .action(async (recipient?: string) => {
      const to = recipient || emailConfig?.from?.address || 'test@example.com'
      console.log(`\n📧 Sending Test Email to ${to}...\n`)
      loadAwsCredentials()

      try {
        const { SESClient } = await import('ts-cloud/aws')
        const ses = new SESClient(process.env.AWS_REGION || 'us-east-1')

        const emailDomain = emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'
        const from = `noreply@${emailDomain}`

        const result = await ses.sendEmail({
          FromEmailAddress: from,
          Destination: {
            ToAddresses: [to],
          },
          Content: {
            Simple: {
              Subject: {
                Data: 'Test Email from Stacks',
                Charset: 'UTF-8',
              },
              Body: {
                Text: {
                  Data: 'This is a test email sent from your Stacks application.',
                  Charset: 'UTF-8',
                },
                Html: {
                  Data: `
                    <html>
                      <body style="font-family: sans-serif; padding: 20px;">
                        <h1>🚀 Test Email from Stacks</h1>
                        <p>This is a test email sent from your Stacks application.</p>
                        <p>If you received this, your email server is working correctly!</p>
                        <hr>
                        <p style="color: #666; font-size: 12px;">
                          Sent from ${emailDomain} via Amazon SES
                        </p>
                      </body>
                    </html>
                  `,
                  Charset: 'UTF-8',
                },
              },
            },
          },
        })

        console.log('✅ Test email sent successfully!')
        console.log(`   Message ID: ${result.MessageId}`)
      }
      catch (error: any) {
        console.error('\n❌ Error sending test email:', error.message)
        if (error.message.includes('not verified')) {
          console.log('\n💡 Tip: Make sure your domain is verified in SES.')
          console.log('   Run `buddy email:verify` to check status.')
        }
      }
    })

  buddy
    .command('email:list', descriptions.list)
    .action(async () => {
      console.log('\n📧 Configured Mailboxes\n')

      const emailDomain = emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'
      const mailboxes = emailConfig?.mailboxes || []

      console.log(`Domain: ${emailDomain}`)
      console.log(`Default From: ${emailConfig?.from?.name} <${emailConfig?.from?.address}>`)
      console.log('')

      if (mailboxes.length === 0) {
        console.log('No mailboxes configured.')
        console.log('\n💡 Add mailboxes in config/email.ts:')
        console.log('   mailboxes: ["user@domain.com", "another@domain.com"]')
      }
      else {
        console.log('Mailboxes:')
        for (const mailbox of mailboxes) {
          console.log(`  📬 ${mailbox}`)
        }
      }
      console.log('')
    })

  buddy
    .command('email:logs', descriptions.logs)
    .option('-n, --lines <count>', 'Number of log lines to show', { default: '20' })
    .action(async (options: { lines?: string }) => {
      console.log('\n📧 Email Processing Logs\n')
      loadAwsCredentials()

      try {
        const { CloudWatchLogsClient } = await import('ts-cloud/aws')
        const logs = new CloudWatchLogsClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const logGroupName = `/aws/lambda/${appName}-inbound-email`

        console.log(`Log Group: ${logGroupName}`)
        console.log(`Showing last ${options.lines} events...\n`)

        // First get the latest log stream
        const streams = await logs.describeLogStreams({
          logGroupName,
          orderBy: 'LastEventTime',
          descending: true,
          limit: 1,
        })

        if (!streams.logStreams || streams.logStreams.length === 0) {
          console.log('No log streams found.')
          console.log('\n💡 Logs will appear after emails are processed.')
          return
        }

        const logStreamName = streams.logStreams[0].logStreamName
        if (!logStreamName) {
          console.log('No log stream name found.')
          return
        }

        const events = await logs.getLogEvents({
          logGroupName,
          logStreamName,
          limit: parseInt(options.lines || '20', 10),
        })

        if (events.events && events.events.length > 0) {
          for (const event of events.events) {
            const time = new Date(event.timestamp || 0).toISOString()
            console.log(`[${time}] ${event.message}`)
          }
        }
        else {
          console.log('No log events found.')
          console.log('\n💡 Logs will appear after emails are processed.')
        }
      }
      catch (error: any) {
        if (error.message.includes('ResourceNotFoundException')) {
          console.log('Log group not found. No emails have been processed yet.')
        }
        else {
          console.error('Error fetching logs:', error.message)
        }
      }
    })

  buddy
    .command('email:status', descriptions.status)
    .action(async () => {
      console.log('\n📧 Email Server Status\n')
      loadAwsCredentials()

      try {
        const { CloudFormationClient } = await import('ts-cloud/aws')
        const cf = new CloudFormationClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const stackName = `${appName}-cloud`

        const result = await cf.listStackResources(stackName)
        const emailResources = result.StackResourceSummaries?.filter(
          (r: any) => r.LogicalResourceId.includes('Email') || r.LogicalResourceId.includes('Inbound') || r.LogicalResourceId.includes('Outbound')
        ) || []

        if (emailResources.length === 0) {
          console.log('❌ Email server not deployed.')
          console.log('\n💡 Run `buddy deploy` to set up email infrastructure.')
          return
        }

        console.log('✅ Email Server Deployed\n')
        console.log('Resources:')
        for (const resource of emailResources) {
          const status = resource.ResourceStatus === 'CREATE_COMPLETE' || resource.ResourceStatus === 'UPDATE_COMPLETE' ? '✅' : '⏳'
          console.log(`  ${status} ${resource.LogicalResourceId}`)
        }

        // Get outputs
        const stacks = await cf.describeStacks({ stackName })
        const outputs = stacks.Stacks?.[0]?.Outputs || []
        const emailOutputs = outputs.filter((o: any) => o.OutputKey?.includes('Email'))

        if (emailOutputs.length > 0) {
          console.log('\nConfiguration:')
          for (const output of emailOutputs) {
            console.log(`  ${output.OutputKey}: ${output.OutputValue}`)
          }
        }
      }
      catch (error: any) {
        console.error('Error checking status:', error.message)
      }
    })
}
