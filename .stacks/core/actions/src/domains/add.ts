import process from 'node:process'
import { createHostedZone } from '@stacksjs/dns'
import { app } from '@stacksjs/config'
import { handleError } from '@stacksjs/error-handling'
import { italic, parseOptions } from '@stacksjs/cli'
import { whois } from '@stacksjs/whois'
import { logger } from '@stacksjs/logging'

interface AddOptions {
  domain?: string
  verbose: boolean
}

const parsedOptions = parseOptions()
const options: AddOptions = {
  domain: parsedOptions.domain as string,
  verbose: parsedOptions.verbose as boolean,
}

if (!options.domain) {
  if (app.url) {
    options.domain = app.url
  }
  else {
    handleError('there was no domain provided when')
    process.exit(1)
  }
}

const result = await createHostedZone(options.domain)

if (result.isErr()) {
  handleError(result.error)
  process.exit(1)
}

const nameservers = result.value

logger.log('')
logger.log('✅ Successfully added your domain.')
logger.log('')
logger.log('ℹ️  Please note, before you can you continue your deployment process,')
logger.log('   you will need to update your nameservers to the following:')

const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣']
logger.log('')
nameservers.forEach((nameserver, index) => {
  logger.log(`  ${emojis[index]}  Nameserver: ${nameserver}`)
})
logger.log('')
logger.log(italic(`stored in ${projectConfigPath('dns.ts')}`))
logger.log('')
logger.log('Once the nameservers have been updated, re-run the following command:')
logger.log('')
logger.log(`  ➡️  ${italic('buddy deploy')}`)
logger.log('')
logger.log(`Your domain registrar is: ${(await whois(options.domain, true)).parsedData.Registrar}`)
logger.log('If you have any questions, please reach out to us via Discord.')
