import type { CLI } from '@stacksjs/types'
import { getErrorMessage } from '@stacksjs/utils'
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
  verify: 'Verify a sandbox phone number',
  'add-phone': 'Add a phone to sandbox for testing',
}

export function sms(buddy: CLI): void {
  buddy
    .command('sms', descriptions.sms)
    .action(async () => {
      console.log('\n📱 SMS Service Commands\n')
      console.log('  buddy sms:status     - Show SMS service status')
      console.log('  buddy sms:send       - Send a test SMS')
      console.log('  buddy sms:setup      - Initialize SMS infrastructure')
      console.log('  buddy sms:add-phone  - Add a phone to sandbox for testing')
      console.log('  buddy sms:verify     - Verify a sandbox phone number with OTP')
      console.log('')
      process.exit(0)
    })

  buddy
    .command('sms:status', descriptions.status)
    .action(async () => {
      console.log('\n📱 SMS Service Status\n')
      loadAwsCredentials()

      try {
        const { getSmsInfrastructureStatus } = await import('@stacksjs/ts-cloud' as any)

        const status: any = await withTimeout(
          getSmsInfrastructureStatus({
            region: process.env.AWS_REGION || 'us-east-1',
            accountName: 'stacks',
          }),
          30000
        )

        // Phone Numbers
        console.log('Phone Numbers:')
        if (status.phoneNumbers.length === 0) {
          console.log('  No phone numbers provisioned')
          console.log('  Run `buddy sms:setup` to provision a phone number')
        }
        else {
          for (const phone of status.phoneNumbers) {
            console.log(`  ${phone.phoneNumber}`)
            console.log(`    Status: ${phone.status}`)
            console.log(`    Two-Way: ${phone.twoWayEnabled ? 'Enabled' : 'Disabled'}`)
            console.log(`    Capabilities: ${phone.capabilities.join(', ') || 'N/A'}`)
          }
        }

        // Sandbox & Limits
        console.log('\nAccount:')
        console.log(`  Sandbox Status: ${status.sandboxStatus === 'IN_SANDBOX' ? '⚠️ In Sandbox' : '✅ Production'}`)
        console.log(`  Spending Limit: $${status.spendingLimit}/month`)

        // Topics
        console.log('\nSNS Topics:')
        if (status.topics.length === 0) {
          console.log('  No SMS topics configured')
        }
        else {
          for (const topic of status.topics) {
            console.log(`  ${topic.name}`)
          }
        }

        // Recommendations
        if (status.sandboxStatus === 'IN_SANDBOX') {
          console.log('\n💡 To exit sandbox mode:')
          console.log('   Run `buddy sms:setup` to file a support request')
          console.log('   Or visit AWS Console > End User Messaging > SMS > Request production access')
        }

        if (status.phoneNumbers.some((p: any) => p.status === 'PENDING')) {
          console.log('\n⏳ Note: Phone number verification can take 24-72 hours for toll-free numbers')
        }
      }
      catch (error: unknown) {
        console.error('Error checking status:', getErrorMessage(error))

        // Try basic check with End User Messaging API
        try {
          const { PinpointSmsVoiceClient } = await import('@stacksjs/ts-cloud' as any)
          const smsClient = new PinpointSmsVoiceClient(process.env.AWS_REGION || 'us-east-1')

          const phoneNumbers: any = await withTimeout(smsClient.describePhoneNumbers({}))
          const activeNumbers = phoneNumbers.PhoneNumbers?.filter((p: any) => p.Status === 'ACTIVE' || p.Status === 'PENDING')

          if (activeNumbers && activeNumbers.length > 0) {
            console.log('\n✅ SMS Service Active (End User Messaging)')
            for (const phone of activeNumbers) {
              console.log(`  Phone: ${phone.PhoneNumber} (${phone.Status})`)
            }
          }
          else {
            console.log('\n❌ SMS service not deployed.')
            console.log('   Run `buddy sms:setup` to initialize')
          }
        }
        catch {
          console.log('\n❌ Could not connect to AWS. Check credentials.')
        }
      }
      process.exit(0)
    })

  buddy
    .command('sms:send <phone> [message]', descriptions.send)
    .option('--template <name>', 'Use a message template')
    .action(async (phone: string, message?: string, options?: { template?: string }) => {
      const msg = message || 'Test message from Stacks'
      console.log(`\n📱 Sending SMS to ${phone}...\n`)
      loadAwsCredentials()

      try {
        // Try Pinpoint SMS Voice V2 first (more reliable)
        const { SMSClient } = await import('@stacksjs/ts-cloud' as any)
        const smsClient = new SMSClient({
          region: process.env.AWS_REGION || 'us-east-1',
        })

        // Get origination number from config or existing phone numbers
        const smsConfig = await import('@stacksjs/config').then(m => (m.config as any)?.sms)
        let originationNumber = smsConfig?.originationNumber

        // If no configured origination number, try to find one
        if (!originationNumber) {
          const { PinpointSmsVoiceClient } = await import('@stacksjs/ts-cloud' as any)
          const pinpointV2 = new PinpointSmsVoiceClient(process.env.AWS_REGION || 'us-east-1')
          const phoneNumbers: any = await withTimeout(pinpointV2.describePhoneNumbers({}))
          const activePhone = phoneNumbers.PhoneNumbers?.find((p: any) => p.Status === 'ACTIVE')
          originationNumber = activePhone?.PhoneNumber
        }

        // Handle template if specified
        let finalMessage = msg
        if (options?.template && smsConfig?.templates) {
          const template = smsConfig.templates.find((t: any) => t.name === options.template)
          if (template) {
            finalMessage = template.body
            console.log(`Using template: ${options.template}`)
          }
          else {
            console.log(`Template "${options.template}" not found. Using default message.`)
          }
        }

        const result: any = await withTimeout(smsClient.send({
          to: phone,
          message: finalMessage,
          originationNumber,
        }), 30000)

        if (result.messageId) {
          console.log('✅ SMS sent successfully!')
          console.log(`   Message ID: ${result.messageId}`)
          if (originationNumber) {
            console.log(`   From: ${originationNumber}`)
          }
        }
        else {
          console.log('❌ SMS send failed')
        }
      }
      catch (error: unknown) {
        console.error('Error sending SMS:', getErrorMessage(error))

        if (getErrorMessage(error).includes('not found') || getErrorMessage(error).includes('No phone')) {
          console.log('\n💡 No origination phone number available.')
          console.log('   Run `buddy sms:setup` to provision a phone number.')
        }
        else if (getErrorMessage(error).includes('not authorized')) {
          console.log('\n💡 Make sure your AWS account has SMS permissions.')
        }
        else if (getErrorMessage(error).includes('sandbox')) {
          console.log('\n💡 Your account is in SMS sandbox. Run `buddy sms:setup` to request production access.')
        }
        else if (getErrorMessage(error).includes('PENDING')) {
          console.log('\n💡 Phone number is still pending verification (24-72 hours for toll-free).')
          console.log('   Run `buddy sms:status` to check current status.')
        }
      }
      process.exit(0)
    })

  buddy
    .command('sms:setup', descriptions.setup)
    .option('--dry-run', 'Show what would be done without making changes')
    .action(async (options: { dryRun?: boolean }) => {
      console.log('\n📱 SMS Service Setup\n')
      loadAwsCredentials()

      try {
        // Import SMS config
        const smsConfig = await import('@stacksjs/config').then(m => (m.config as any)?.sms)

        if (!smsConfig?.enabled) {
          console.log('SMS is disabled in config/sms.ts')
          console.log('\nTo enable SMS:')
          console.log('1. Edit config/sms.ts and set enabled: true')
          console.log('2. Run `buddy sms:setup` again')
          process.exit(0)
          return
        }

        if (options.dryRun) {
          console.log('[Dry Run] Would set up SMS infrastructure with config:')
          console.log(`  Provider: ${smsConfig.provider}`)
          console.log(`  Country: ${smsConfig.defaultCountryCode}`)
          console.log(`  Message Type: ${smsConfig.messageType}`)
          console.log(`  Monthly Limit: $${smsConfig.maxSpendPerMonth || 1}`)
          console.log(`  Two-Way: ${smsConfig.twoWay?.enabled ? 'Enabled' : 'Disabled'}`)
          console.log(`  Inbox: ${smsConfig.inbox?.enabled ? 'Enabled' : 'Disabled'}`)
          process.exit(0)
          return
        }

        console.log('Setting up SMS infrastructure...\n')

        const { createSmsInfrastructure } = await import('@stacksjs/ts-cloud' as any)

        const result: any = await withTimeout(
          createSmsInfrastructure({
            enabled: smsConfig.enabled,
            provider: smsConfig.provider || 'pinpoint',
            originationNumber: smsConfig.originationNumber,
            defaultCountryCode: smsConfig.defaultCountryCode || 'US',
            messageType: smsConfig.messageType || 'TRANSACTIONAL',
            maxSpendPerMonth: smsConfig.maxSpendPerMonth,
            inbox: smsConfig.inbox,
            twoWay: smsConfig.twoWay,
            optOut: smsConfig.optOut || { enabled: true, keywords: ['STOP'] },
          }),
          120000 // 2 minute timeout
        )

        if (result.success) {
          console.log('\n✅ SMS infrastructure setup complete!\n')
          if (result.phoneNumber) {
            console.log(`  Phone Number: ${result.phoneNumber} (${result.phoneNumberStatus})`)
          }
          if (result.twoWayTopicArn) {
            console.log(`  Two-Way Topic: ${result.twoWayTopicArn}`)
          }
          if (result.inboxBucket) {
            console.log(`  Inbox: s3://${result.inboxBucket}/${result.inboxPrefix}`)
          }
          console.log(`  Spending Limit: $${result.spendingLimit}/month`)
          console.log(`  Sandbox Status: ${result.sandboxStatus}`)

          if (result.supportCaseId) {
            console.log(`\n  📋 Support Case: ${result.supportCaseId}`)
            console.log('     A support ticket has been filed for sandbox exit.')
          }

          if (result.warnings.length > 0) {
            console.log('\n⚠️  Warnings:')
            for (const warning of result.warnings) {
              console.log(`   - ${warning}`)
            }
          }

          console.log('\n💡 Next steps:')
          console.log('   - Run `buddy sms:send +1234567890 "Test"` to send a test SMS')
          console.log('   - Run `buddy sms:status` to check current status')
        }
        else {
          console.log('\n❌ SMS setup completed with errors:\n')
          for (const error of result.errors) {
            console.log(`   - ${error}`)
          }
        }
      }
      catch (error: unknown) {
        console.error('Error setting up SMS:', getErrorMessage(error))
        if (getErrorMessage(error).includes('timeout')) {
          console.log('\n💡 Setup timed out. Some operations may have completed.')
          console.log('   Run `buddy sms:status` to check current status.')
        }
      }
      process.exit(0)
    })

  buddy
    .command('sms:add-phone <phone>', descriptions['add-phone'])
    .action(async (phone: string) => {
      console.log(`\n📱 Adding ${phone} to SMS sandbox...\n`)
      loadAwsCredentials()

      try {
        const { PinpointSmsVoiceClient } = await import('@stacksjs/ts-cloud' as any)
        const smsClient = new PinpointSmsVoiceClient(process.env.AWS_REGION || 'us-east-1')

        const result: any = await withTimeout(smsClient.addSandboxPhone(phone), 30000)

        if (result.status === 'VERIFIED') {
          console.log('✅ Phone is already verified!')
          console.log(`   ID: ${result.verifiedDestinationNumberId}`)
        }
        else if (result.status === 'PENDING') {
          console.log('📨 Verification code sent to phone!')
          console.log(`   ID: ${result.verifiedDestinationNumberId}`)
          console.log('\n💡 Next step:')
          console.log(`   Run: buddy sms:verify ${result.verifiedDestinationNumberId} <code>`)
          console.log('   Replace <code> with the 6-digit code you received')
        }
        else {
          console.log('❓ Unexpected status:', result.status)
          console.log('   Message:', result.message)
        }
      }
      catch (error: unknown) {
        console.error('Error adding phone:', getErrorMessage(error))
        if (getErrorMessage(error).includes('already exists')) {
          console.log('\n💡 Phone number may already be in the sandbox.')
          console.log('   Run `buddy sms:status` to check sandbox numbers.')
        }
      }
      process.exit(0)
    })

  buddy
    .command('sms:verify <id> <code>', descriptions.verify)
    .action(async (id: string, code: string) => {
      console.log(`\n📱 Verifying sandbox phone...\n`)
      loadAwsCredentials()

      try {
        const { PinpointSmsVoiceClient } = await import('@stacksjs/ts-cloud' as any)
        const smsClient = new PinpointSmsVoiceClient(process.env.AWS_REGION || 'us-east-1')

        const result: any = await withTimeout(smsClient.verifySandboxPhone(id, code), 30000)

        if (result.success) {
          console.log('✅ Phone verified successfully!')
          console.log(`   Phone: ${result.phoneNumber}`)
          console.log('\n💡 You can now send SMS to this phone while in sandbox mode.')
          console.log(`   Run: buddy sms:send ${result.phoneNumber} "Test message"`)
        }
        else {
          console.log('❌ Verification failed')
          console.log(`   Error: ${result.message}`)
          console.log('\n💡 Make sure you entered the correct 6-digit code.')
          console.log('   Run `buddy sms:add-phone <phone>` to resend the code.')
        }
      }
      catch (error: unknown) {
        console.error('Error verifying phone:', getErrorMessage(error))
      }
      process.exit(0)
    })

  buddy
    .command('sms:sandbox-list', 'List sandbox verified phone numbers')
    .action(async () => {
      console.log('\n📱 Sandbox Verified Numbers\n')
      loadAwsCredentials()

      try {
        const { PinpointSmsVoiceClient } = await import('@stacksjs/ts-cloud' as any)
        const smsClient = new PinpointSmsVoiceClient(process.env.AWS_REGION || 'us-east-1')

        const phones: any = await withTimeout(smsClient.listSandboxPhones(), 30000)

        if (phones.length === 0) {
          console.log('No verified sandbox numbers yet.')
          console.log('\nTo add a phone:')
          console.log('  buddy sms:add-phone +1234567890')
        }
        else {
          for (const phone of phones) {
            const statusIcon = phone.status === 'VERIFIED' ? '✅' : '⏳'
            console.log(`  ${statusIcon} ${phone.phoneNumber} (${phone.status})`)
            console.log(`     ID: ${phone.id}`)
          }
        }
      }
      catch (error: unknown) {
        console.error('Error listing sandbox phones:', getErrorMessage(error))
      }
      process.exit(0)
    })
}
