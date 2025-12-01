import type { CLI } from '@stacksjs/types'
import { readFileSync, existsSync } from 'node:fs'

const TIMEOUT_MS = 30000

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
  sms: 'SMS service management commands',
  status: 'Show SMS service status',
  send: 'Send a test SMS',
  setup: 'Initialize SMS infrastructure',
}

export function sms(buddy: CLI): void {
  buddy
    .command('sms', descriptions.sms)
    .action(async () => {
      console.log('\n📱 SMS Service Commands\n')
      console.log('  buddy sms:status  - Show SMS service status')
      console.log('  buddy sms:send    - Send a test SMS')
      console.log('  buddy sms:setup   - Initialize SMS infrastructure')
      console.log('')
      process.exit(0)
    })

  buddy
    .command('sms:status', descriptions.status)
    .action(async () => {
      console.log('\n📱 SMS Service Status\n')
      loadAwsCredentials()

      try {
        const { PinpointClient } = await import('ts-cloud/aws')
        const pinpoint = new PinpointClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

        console.log(`Looking for Pinpoint app: ${appName}-sms`)

        const apps = await withTimeout(pinpoint.listApps({ PageSize: 100 }))
        const app = apps.Item?.find(a => a.Name === `${appName}-sms`)

        if (app?.Id) {
          console.log('\n✅ SMS Service Active\n')
          console.log(`  App ID: ${app.Id}`)
          console.log(`  Name: ${app.Name}`)
          console.log(`  Created: ${app.CreationDate}`)

          // Get SMS channel status
          try {
            const channel = await withTimeout(pinpoint.getSmsChannel(app.Id))
            console.log('\n  SMS Channel:')
            console.log(`    Enabled: ${channel.Enabled ? 'Yes' : 'No'}`)
            if (channel.SenderId) console.log(`    Sender ID: ${channel.SenderId}`)
            if (channel.ShortCode) console.log(`    Short Code: ${channel.ShortCode}`)
          }
          catch {
            console.log('\n  SMS Channel: Not configured')
          }
        }
        else {
          console.log('\n❌ SMS service not deployed.')
          console.log('\n💡 To set up SMS service:')
          console.log('   1. Enable SMS in config/sms.ts')
          console.log('   2. Run `buddy deploy`')
        }
      }
      catch (error: any) {
        console.error('Error checking status:', error.message)
      }
      process.exit(0)
    })

  buddy
    .command('sms:send <phone> [message]', descriptions.send)
    .action(async (phone: string, message?: string) => {
      const msg = message || 'Test message from Stacks'
      console.log(`\n📱 Sending SMS to ${phone}...\n`)
      loadAwsCredentials()

      try {
        const { PinpointClient } = await import('ts-cloud/aws')
        const pinpoint = new PinpointClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')

        const apps = await withTimeout(pinpoint.listApps({ PageSize: 100 }))
        const app = apps.Item?.find(a => a.Name === `${appName}-sms`)

        if (!app?.Id) {
          console.log('SMS service not deployed. Run `buddy sms:setup` first.')
          process.exit(1)
          return
        }

        const result = await withTimeout(pinpoint.sendSms({
          ApplicationId: app.Id,
          PhoneNumber: phone,
          Message: msg,
          MessageType: 'TRANSACTIONAL',
        }))

        if (result.DeliveryStatus === 'SUCCESSFUL') {
          console.log('✅ SMS sent successfully!')
          console.log(`   Message ID: ${result.MessageId}`)
        }
        else {
          console.log(`❌ SMS delivery status: ${result.DeliveryStatus}`)
          if (result.StatusMessage) {
            console.log(`   ${result.StatusMessage}`)
          }
        }
      }
      catch (error: any) {
        console.error('Error sending SMS:', error.message)
        if (error.message.includes('not authorized')) {
          console.log('\n💡 Make sure your AWS account has Pinpoint SMS permissions.')
        }
      }
      process.exit(0)
    })

  buddy
    .command('sms:setup', descriptions.setup)
    .action(async () => {
      console.log('\n📱 SMS Service Setup\n')
      console.log('Steps to set up SMS service:\n')
      console.log('1. Enable SMS in config/sms.ts:')
      console.log('   enabled: true')
      console.log('')
      console.log('2. Configure your sender ID or origination number:')
      console.log('   senderId: "YourApp"  // For supported countries')
      console.log('   // OR')
      console.log('   originationNumber: "+1234567890"  // Dedicated number')
      console.log('')
      console.log('3. Run `buddy deploy` to create the Pinpoint application')
      console.log('')
      console.log('4. For production use:')
      console.log('   - Request production access in AWS Pinpoint console')
      console.log('   - Register your sender ID (if required by country)')
      console.log('   - Set up spend limits')
      console.log('')
      console.log('5. Use `buddy sms:status` to verify setup')
      console.log('')
      process.exit(0)
    })
}
