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
  phone: 'Phone/voice service management commands',
  status: 'Show phone service status',
  numbers: 'List phone numbers',
  search: 'Search available phone numbers',
  setup: 'Initialize phone infrastructure',
}

export function phone(buddy: CLI): void {
  buddy
    .command('phone', descriptions.phone)
    .action(async () => {
      console.log('\n📞 Phone Service Commands\n')
      console.log('  buddy phone:status   - Show phone service status')
      console.log('  buddy phone:numbers  - List phone numbers')
      console.log('  buddy phone:search   - Search available phone numbers')
      console.log('  buddy phone:setup    - Initialize phone infrastructure')
      console.log('')
      process.exit(0)
    })

  buddy
    .command('phone:status', descriptions.status)
    .action(async () => {
      console.log('\n📞 Phone Service Status\n')
      loadAwsCredentials()

      try {
        const { ConnectClient } = await import('ts-cloud/aws')
        const connect = new ConnectClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const instanceAlias = `${appName}-phone`

        console.log(`Looking for Connect instance: ${instanceAlias}`)

        const instances = await withTimeout(connect.listInstances({ MaxResults: 100 }))
        const instance = instances.InstanceSummaryList?.find(
          i => i.InstanceAlias === instanceAlias
        )

        if (instance) {
          console.log('\n✅ Phone Service Active\n')
          console.log(`  Instance ID: ${instance.Id}`)
          console.log(`  Alias: ${instance.InstanceAlias}`)
          console.log(`  Status: ${instance.InstanceStatus}`)
          console.log(`  Inbound Calls: ${instance.InboundCallsEnabled ? 'Enabled' : 'Disabled'}`)
          console.log(`  Outbound Calls: ${instance.OutboundCallsEnabled ? 'Enabled' : 'Disabled'}`)

          // List phone numbers
          if (instance.Id) {
            try {
              const numbers = await withTimeout(connect.listPhoneNumbers({ InstanceId: instance.Id }))
              if (numbers.ListPhoneNumbersSummaryList && numbers.ListPhoneNumbersSummaryList.length > 0) {
                console.log('\n  Phone Numbers:')
                for (const num of numbers.ListPhoneNumbersSummaryList) {
                  console.log(`    📱 ${num.PhoneNumber} (${num.PhoneNumberType})`)
                }
              }
              else {
                console.log('\n  No phone numbers claimed yet.')
              }
            }
            catch {
              console.log('\n  Could not retrieve phone numbers.')
            }
          }
        }
        else {
          console.log('\n❌ Phone service not deployed.')
          console.log('\n💡 To set up phone service:')
          console.log('   1. Enable phone in config/phone.ts')
          console.log('   2. Run `buddy deploy`')
        }
      }
      catch (error: any) {
        console.error('Error checking status:', error.message)
      }
      process.exit(0)
    })

  buddy
    .command('phone:numbers', descriptions.numbers)
    .action(async () => {
      console.log('\n📞 Phone Numbers\n')
      loadAwsCredentials()

      try {
        const { ConnectClient } = await import('ts-cloud/aws')
        const connect = new ConnectClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const instanceAlias = `${appName}-phone`

        const instances = await withTimeout(connect.listInstances({ MaxResults: 100 }))
        const instance = instances.InstanceSummaryList?.find(
          i => i.InstanceAlias === instanceAlias
        )

        if (!instance?.Id) {
          console.log('Phone service not deployed. Run `buddy phone:setup` first.')
          process.exit(0)
          return
        }

        const numbers = await withTimeout(connect.listPhoneNumbers({ InstanceId: instance.Id }))

        if (!numbers.ListPhoneNumbersSummaryList || numbers.ListPhoneNumbersSummaryList.length === 0) {
          console.log('No phone numbers claimed.')
          console.log('\n💡 Use `buddy phone:search` to find available numbers.')
          process.exit(0)
          return
        }

        console.log('Claimed Phone Numbers:\n')
        for (const num of numbers.ListPhoneNumbersSummaryList) {
          console.log(`  📱 ${num.PhoneNumber}`)
          console.log(`     Type: ${num.PhoneNumberType}`)
          console.log(`     Country: ${num.PhoneNumberCountryCode}`)
          if (num.PhoneNumberDescription) {
            console.log(`     Description: ${num.PhoneNumberDescription}`)
          }
          console.log('')
        }
      }
      catch (error: any) {
        console.error('Error listing numbers:', error.message)
      }
      process.exit(0)
    })

  buddy
    .command('phone:search [country]', descriptions.search)
    .option('-t, --type <type>', 'Phone number type (TOLL_FREE, DID)', { default: 'TOLL_FREE' })
    .action(async (country: string | undefined, options: { type?: string }) => {
      const countryCode = country?.toUpperCase() || 'US'
      const phoneType = (options.type?.toUpperCase() || 'TOLL_FREE') as 'TOLL_FREE' | 'DID' | 'UIFN'

      console.log(`\n📞 Searching for ${phoneType} numbers in ${countryCode}...\n`)
      loadAwsCredentials()

      try {
        const { ConnectClient } = await import('ts-cloud/aws')
        const connect = new ConnectClient(process.env.AWS_REGION || 'us-east-1')

        const appName = (process.env.APP_NAME || 'stacks').toLowerCase().replace(/[^a-z0-9-]/g, '-')
        const instanceAlias = `${appName}-phone`

        const instances = await withTimeout(connect.listInstances({ MaxResults: 100 }))
        const instance = instances.InstanceSummaryList?.find(
          i => i.InstanceAlias === instanceAlias
        )

        if (!instance?.Arn) {
          console.log('Phone service not deployed. Run `buddy phone:setup` first.')
          process.exit(0)
          return
        }

        const available = await withTimeout(connect.searchAvailablePhoneNumbers({
          TargetArn: instance.Arn,
          PhoneNumberCountryCode: countryCode,
          PhoneNumberType: phoneType,
          MaxResults: 10,
        }))

        if (!available.AvailableNumbersList || available.AvailableNumbersList.length === 0) {
          console.log(`No ${phoneType} numbers available in ${countryCode}.`)
          console.log('\n💡 Try a different country or number type.')
          process.exit(0)
          return
        }

        console.log('Available Phone Numbers:\n')
        for (const num of available.AvailableNumbersList) {
          console.log(`  📱 ${num.PhoneNumber}`)
        }
        console.log('\n💡 To claim a number, use `buddy phone:claim <number>`')
      }
      catch (error: any) {
        if (error.message.includes('not authorized')) {
          console.log('Not authorized to search phone numbers.')
          console.log('Make sure your AWS account has Amazon Connect permissions.')
        }
        else {
          console.error('Error searching numbers:', error.message)
        }
      }
      process.exit(0)
    })

  buddy
    .command('phone:setup', descriptions.setup)
    .action(async () => {
      console.log('\n📞 Phone Service Setup\n')
      console.log('Amazon Connect setup requires manual configuration.')
      console.log('\nSteps to set up phone service:\n')
      console.log('1. Enable phone in config/phone.ts:')
      console.log('   enabled: true')
      console.log('')
      console.log('2. Run `buddy deploy` to create the Connect instance')
      console.log('')
      console.log('3. Access the Connect console to:')
      console.log('   - Claim phone numbers')
      console.log('   - Configure contact flows')
      console.log('   - Set up routing profiles')
      console.log('')
      console.log('4. Use `buddy phone:status` to verify setup')
      console.log('')
      process.exit(0)
    })
}
