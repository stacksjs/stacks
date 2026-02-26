import type { CLI } from '@stacksjs/types'
import { readFileSync, existsSync } from 'node:fs'
import { email as emailConfig } from '@stacksjs/config'

const TIMEOUT_MS = 30000 // 30 second timeout for AWS operations

// Helper to run async operations with timeout
async function withTimeout<T>(promise: Promise<T>, ms: number = TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    clearTimeout(timeoutId!)
  }
}

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
  inbox: 'View inbox emails from S3',
  reprocess: 'Reprocess raw emails from S3 into mailbox structure',
}

export function email(buddy: CLI): void {
  buddy
    .command('email', descriptions.email)
    .alias('mail')
    .action(async () => {
      console.log('\n📧 Email Server Commands\n')
      console.log('  buddy email:verify      - Check domain verification status')
      console.log('  buddy email:test        - Send a test email')
      console.log('  buddy email:list        - List configured mailboxes')
      console.log('  buddy email:inbox       - View inbox emails from S3')
      console.log('  buddy email:reprocess   - Reprocess raw emails into mailbox structure')
      console.log('  buddy email:logs        - View email processing logs')
      console.log('  buddy email:status      - Show email server status')
      console.log('')
    })

  buddy
    .command('email:verify', descriptions.verify)
    .action(async () => {
      console.log('\n📧 Checking Email Domain Verification...\n')
      loadAwsCredentials()

      try {
        const { SESClient } = await import('@stacksjs/ts-cloud')
        const ses = new SESClient(process.env.AWS_REGION || 'us-east-1')

        const emailDomain = emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'
        console.log(`Domain: ${emailDomain}`)

        const identity = await withTimeout(ses.getEmailIdentity(emailDomain))

        if (identity) {
          console.log(`\n✅ Domain Status: ${(identity as any).VerificationStatus || 'Unknown'}`)

          if ((identity as any).DkimAttributes) {
            console.log(`\nDKIM Status: ${(identity as any).DkimAttributes.Status || 'Unknown'}`)
            if ((identity as any).DkimAttributes.Tokens) {
              console.log('\nDKIM Records needed:')
              for (const token of (identity as any).DkimAttributes.Tokens) {
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
      process.exit(0)
    })

  buddy
    .command('email:test [recipient]', descriptions.test)
    .action(async (recipient?: string) => {
      const to = recipient || emailConfig?.from?.address || 'test@example.com'
      console.log(`\n📧 Sending Test Email to ${to}...\n`)
      loadAwsCredentials()

      try {
        const { SESClient } = await import('@stacksjs/ts-cloud')
        const ses = new SESClient(process.env.AWS_REGION || 'us-east-1')

        const emailDomain = emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'
        const from = `noreply@${emailDomain}`

        const result = await withTimeout(ses.sendEmail({
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
        }))

        console.log('✅ Test email sent successfully!')
        console.log(`   Message ID: ${(result as any).MessageId}`)
      }
      catch (error: any) {
        console.error('\n❌ Error sending test email:', error.message)
        if (error.message.includes('not verified')) {
          console.log('\n💡 Tip: Make sure your domain is verified in SES.')
          console.log('   Run `buddy email:verify` to check status.')
        }
      }
      process.exit(0)
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
      process.exit(0)
    })

  buddy
    .command('email:logs', descriptions.logs)
    .option('-n, --lines <count>', 'Number of log lines to show', { default: '20' })
    .action(async (options: { lines?: string }) => {
      console.log('\n📧 Email Processing Logs\n')
      loadAwsCredentials()

      try {
        const { CloudWatchLogsClient } = await import('@stacksjs/ts-cloud')
        const logs = new CloudWatchLogsClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const logGroupName = `/aws/lambda/${appName}-inbound-email`

        console.log(`Log Group: ${logGroupName}`)
        console.log(`Showing last ${options.lines} events...\n`)

        // First get the latest log stream
        const streams = await withTimeout(logs.describeLogStreams({
          logGroupName,
          orderBy: 'LastEventTime',
          descending: true,
          limit: 1,
        }))

        if (!(streams as any).logStreams || (streams as any).logStreams.length === 0) {
          console.log('No log streams found.')
          console.log('\n💡 Logs will appear after emails are processed.')
          return
        }

        const logStreamName = (streams as any).logStreams[0].logStreamName
        if (!logStreamName) {
          console.log('No log stream name found.')
          return
        }

        const events = await withTimeout(logs.getLogEvents({
          logGroupName,
          logStreamName,
          limit: parseInt(options.lines || '20', 10),
        }))

        if ((events as any).events && (events as any).events.length > 0) {
          for (const event of (events as any).events) {
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
        if (error.message.includes('ResourceNotFoundException') || error.message.includes('timed out')) {
          console.log('Log group not found or not accessible. No emails have been processed yet.')
        }
        else {
          console.error('Error fetching logs:', error.message)
        }
      }
      process.exit(0)
    })

  buddy
    .command('email:status', descriptions.status)
    .action(async () => {
      console.log('\n📧 Email Server Status\n')
      loadAwsCredentials()

      try {
        const { AWSCloudFormationClient } = await import('@stacksjs/ts-cloud')
        const cf = new AWSCloudFormationClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const stackName = `${appName}-cloud`

        const result = await withTimeout(cf.listStackResources(stackName))
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
        const stacks = await withTimeout(cf.describeStacks({ stackName }))
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
      process.exit(0)
    })

  buddy
    .command('email:inbox [mailbox]', descriptions.inbox)
    .option('-n, --limit <count>', 'Number of emails to show', { default: '20' })
    .option('--raw <id>', 'Show raw email content for a specific message ID')
    .option('--bucket <name>', 'S3 bucket name override')
    .action(async (mailbox?: string, options?: { limit?: string; raw?: string; bucket?: string }) => {
      loadAwsCredentials()

      const region = process.env.AWS_REGION || 'us-east-1'
      const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const emailDomain = emailConfig?.from?.address?.split('@')[1] || 'stacksjs.com'
      const bucketName = options?.bucket || `${appName}-production-email`

      // If --raw flag, show raw email content
      if (options?.raw) {
        console.log(`\n📧 Fetching raw email: ${options.raw}\n`)
        try {
          const { S3Client } = await import('@stacksjs/ts-cloud')
          const s3 = new S3Client(region)

          // Try inbox/ prefix first (raw SES storage)
          let rawContent: string | null = null
          try {
            rawContent = await withTimeout(s3.getObject(bucketName, `inbox/${options.raw}`))
          } catch (e) {
            // Try the organized path if a mailbox is specified
            if (mailbox) {
              const [localPart, domain] = mailbox.includes('@') ? mailbox.split('@') : [mailbox, emailDomain]
              // Search in mailboxes path
              const listResult = await withTimeout(s3.listObjects({
                bucket: bucketName,
                prefix: `mailboxes/${domain}/${localPart}/`,
                maxKeys: 1000,
              }))
              const matchingKey = (listResult as any).Contents?.find(
                (obj: any) => obj.Key.includes(options!.raw!) && obj.Key.endsWith('/raw.eml')
              )
              if (matchingKey) {
                rawContent = await withTimeout(s3.getObject(bucketName, matchingKey.Key))
              }
            }
          }

          if (rawContent) {
            console.log(rawContent)
          } else {
            console.log('Email not found.')
          }
        } catch (error: any) {
          console.error('Error fetching email:', error.message)
        }
        process.exit(0)
        return
      }

      const resolvedMailbox = mailbox || `chris@${emailDomain}`
      const [localPart, domain] = resolvedMailbox.includes('@')
        ? resolvedMailbox.split('@')
        : [resolvedMailbox, emailDomain]

      console.log(`\n📧 Inbox for ${localPart}@${domain}\n`)
      console.log(`   Bucket: ${bucketName}`)
      console.log('')

      try {
        const { S3Client } = await import('@stacksjs/ts-cloud')
        const s3 = new S3Client(region)
        const limit = parseInt(options?.limit || '20', 10)

        // Strategy 1: Try reading inbox.json (EmailSDK structure)
        const inboxKey = `mailboxes/${domain}/${localPart}/inbox.json`
        let inboxEmails: any[] = []
        let source = 'mailboxes'

        try {
          const inboxData = await withTimeout(s3.getObject(bucketName, inboxKey))
          if (inboxData) {
            inboxEmails = JSON.parse(inboxData)
            source = 'mailboxes'
          }
        } catch (e) {
          // inbox.json doesn't exist yet
        }

        // Strategy 2: Fall back to reading raw emails from inbox/ prefix
        if (inboxEmails.length === 0) {
          console.log('   No processed inbox found. Scanning raw emails from inbox/ ...\n')
          source = 'raw'

          try {
            const listResult = await withTimeout(s3.listObjects({
              bucket: bucketName,
              prefix: 'inbox/',
              maxKeys: limit,
            }))

            const objects = (listResult as any).Contents || []
            if (objects.length === 0) {
              // Also try incoming/ prefix (old format)
              const listResult2 = await withTimeout(s3.listObjects({
                bucket: bucketName,
                prefix: 'incoming/',
                maxKeys: limit,
              }))
              const objects2 = (listResult2 as any).Contents || []
              objects.push(...objects2)
            }

            for (const obj of objects.slice(0, limit)) {
              try {
                const rawEmail = await withTimeout(s3.getObject(bucketName, obj.Key))
                if (!rawEmail) continue

                const headers = parseRawEmailHeaders(rawEmail)
                inboxEmails.push({
                  messageId: obj.Key.split('/').pop() || obj.Key,
                  from: headers.from || 'unknown',
                  subject: headers.subject || 'No Subject',
                  date: headers.date || obj.LastModified || 'unknown',
                  path: obj.Key,
                })
              } catch (parseErr: any) {
                inboxEmails.push({
                  messageId: obj.Key.split('/').pop() || obj.Key,
                  from: 'unknown',
                  subject: '(could not parse)',
                  date: obj.LastModified || 'unknown',
                  path: obj.Key,
                })
              }
            }
          } catch (listErr: any) {
            console.error('Error listing emails:', listErr.message)
          }
        }

        if (inboxEmails.length === 0) {
          console.log('   No emails found.')
          console.log('\n   Waiting for emails to arrive at inbox/ in the S3 bucket.')
          console.log('   Send an email to an @' + domain + ' address to test.')
          process.exit(0)
          return
        }

        // Display emails
        console.log(`   Source: ${source} (${inboxEmails.length} emails)\n`)
        console.log('   %-4s  %-20s  %-30s  %s', '#', 'Date', 'From', 'Subject')
        console.log('   ' + '-'.repeat(90))

        for (let i = 0; i < Math.min(inboxEmails.length, limit); i++) {
          const e = inboxEmails[i]
          const date = e.date ? new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '?'
          const from = (e.from || '').substring(0, 20).padEnd(20)
          const subject = (e.subject || '').substring(0, 40)
          const readMark = e.read === false ? '*' : ' '
          console.log(`   ${readMark}${String(i + 1).padStart(3)}  ${date.padEnd(20)}  ${from}  ${subject}`)
        }

        console.log('')
        console.log('   * = unread')
        console.log(`\n   View raw email: buddy email:inbox ${resolvedMailbox} --raw <messageId>`)
      } catch (error: any) {
        console.error('Error reading inbox:', error.message)
      }
      process.exit(0)
    })

  buddy
    .command('email:reprocess', descriptions.reprocess)
    .option('--bucket <name>', 'S3 bucket name override')
    .option('--prefix <prefix>', 'S3 prefix to scan', { default: 'inbox/' })
    .option('--domain <domain>', 'Email domain', { default: 'stacksjs.com' })
    .action(async (options?: { bucket?: string; prefix?: string; domain?: string }) => {
      loadAwsCredentials()

      const region = process.env.AWS_REGION || 'us-east-1'
      const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
      const bucketName = options?.bucket || `${appName}-production-email`
      const prefix = options?.prefix || 'inbox/'
      const domain = options?.domain || 'stacksjs.com'

      console.log(`\n📧 Reprocessing emails from s3://${bucketName}/${prefix}\n`)

      try {
        const { S3Client } = await import('@stacksjs/ts-cloud')
        const s3 = new S3Client(region)

        // List all raw emails
        const listResult = await withTimeout(s3.listObjects({
          bucket: bucketName,
          prefix,
          maxKeys: 1000,
        }), 60000)

        const objects = (listResult as any).Contents || []
        console.log(`   Found ${objects.length} raw emails to process\n`)

        // Build inbox indexes per recipient
        const inboxes: Record<string, any[]> = {}
        let processed = 0

        for (const obj of objects) {
          if (!obj.Key || obj.Key.endsWith('/')) continue

          try {
            const rawEmail = await withTimeout(s3.getObject(bucketName, obj.Key), 15000)
            if (!rawEmail) continue

            const headers = parseRawEmailHeaders(rawEmail)
            const messageId = obj.Key.split('/').pop() || obj.Key
            const from = extractEmailAddress(headers.from || '')
            const fromName = extractEmailName(headers.from || '')
            const toList = (headers.to || '').split(',').map((s: string) => s.trim()).filter(Boolean)
            const subject = headers.subject || 'No Subject'
            const date = headers.date || (obj.LastModified ? new Date(obj.LastModified).toISOString() : new Date().toISOString())

            // Parse body
            let preview = ''
            const bodyStart = rawEmail.indexOf('\r\n\r\n')
            if (bodyStart > 0) {
              const bodySnippet = rawEmail.substring(bodyStart + 4, bodyStart + 500)
              preview = bodySnippet.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().substring(0, 200)
            }

            // For each recipient on our domain
            const recipients = toList.length > 0 ? toList : [`unknown@${domain}`]
            for (const recipient of recipients) {
              const recipientEmail = extractEmailAddress(recipient)
              if (!recipientEmail.endsWith(`@${domain}`)) continue

              const [localPart] = recipientEmail.split('@')
              const d = new Date(date)
              const year = d.getFullYear()
              const month = String(d.getMonth() + 1).padStart(2, '0')
              const day = String(d.getDate()).padStart(2, '0')

              const emailPath = `mailboxes/${domain}/${localPart}/${year}/${month}/${day}/${messageId}`

              // Write raw email
              await s3.putObject({
                bucket: bucketName,
                key: `${emailPath}/raw.eml`,
                body: rawEmail,
                contentType: 'message/rfc822',
              })

              // Write metadata
              const metadata = { messageId, from, fromName, to: recipientEmail, subject, date, preview, hasAttachments: false }
              await s3.putObject({
                bucket: bucketName,
                key: `${emailPath}/metadata.json`,
                body: JSON.stringify(metadata, null, 2),
                contentType: 'application/json',
              })

              // Build inbox entry
              const inboxKey = `${domain}/${localPart}`
              if (!inboxes[inboxKey]) inboxes[inboxKey] = []
              inboxes[inboxKey].push({
                messageId,
                from,
                fromName,
                to: recipientEmail,
                subject,
                date,
                read: false,
                preview,
                hasAttachments: false,
                path: emailPath,
              })
            }

            processed++
            if (processed % 5 === 0) {
              console.log(`   Processed ${processed}/${objects.length} emails...`)
            }
          } catch (emailErr: any) {
            console.log(`   Skipping ${obj.Key}: ${emailErr.message}`)
          }
        }

        // Write inbox.json for each recipient
        for (const [key, emails] of Object.entries(inboxes)) {
          const [d, localPart] = key.split('/')
          const inboxJsonKey = `mailboxes/${d}/${localPart}/inbox.json`

          // Sort by date descending
          emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

          // Try to merge with existing inbox
          let existing: any[] = []
          try {
            const existingData = await s3.getObject(bucketName, inboxJsonKey)
            if (existingData) existing = JSON.parse(existingData)
          } catch (e) {
            // No existing inbox
          }

          // Merge: add new emails that aren't already in the inbox
          const existingIds = new Set(existing.map((e: any) => e.messageId))
          const newEmails = emails.filter(e => !existingIds.has(e.messageId))
          const merged = [...newEmails, ...existing].slice(0, 1000)

          await s3.putObject({
            bucket: bucketName,
            key: inboxJsonKey,
            body: JSON.stringify(merged, null, 2),
            contentType: 'application/json',
          })

          console.log(`   Updated inbox for ${localPart}@${d}: ${newEmails.length} new emails (${merged.length} total)`)
        }

        console.log(`\n   Done! Processed ${processed} emails.`)
      } catch (error: any) {
        console.error('Error reprocessing:', error.message)
      }
      process.exit(0)
    })
}

// Helper: parse headers from raw email string
function parseRawEmailHeaders(rawEmail: string): Record<string, string> {
  const headers: Record<string, string> = {}
  const lines = rawEmail.split(/\r?\n/)
  let currentKey = ''
  let currentValue = ''

  for (const line of lines) {
    if (line === '') break
    if (/^\s/.test(line) && currentKey) {
      currentValue += ' ' + line.trim()
      headers[currentKey] = currentValue
    } else {
      const match = line.match(/^([^:]+):\s*(.*)$/)
      if (match) {
        currentKey = match[1].toLowerCase()
        currentValue = match[2]
        headers[currentKey] = currentValue
      }
    }
  }

  return headers
}

// Helper: extract email address from "Name <email>" format
function extractEmailAddress(str: string): string {
  if (!str) return ''
  const match = str.match(/<([^>]+)>/)
  return (match ? match[1] : str).toLowerCase().trim()
}

// Helper: extract display name from "Name <email>" format
function extractEmailName(str: string): string {
  if (!str) return ''
  const match = str.match(/^"?([^"<]+)"?\s*</)
  return match ? match[1].trim() : ''
}
