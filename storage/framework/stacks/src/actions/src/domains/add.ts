import process from 'node:process'
import { createHostedZone, getNameservers, updateNameservers } from 'src/dns/src'
import { app } from 'src/config/src'
import { handleError } from 'src/error-handling/src'
import { italic, parseOptions, runCommand } from 'src/cli/src'
import { whois } from 'src/whois/src'
import { logger } from 'src/logging/src'
import { projectConfigPath } from 'src/path/src'

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

// Update the nameservers
const nameServers = await getNameservers(options.domain)

if (!nameServers) {
  handleError(`No nameservers found for domain: ${options.domain}. Please ensure the Hosted Zone exists in Route53.`)
  process.exit(1)
}

await updateNameservers(nameServers)

const nameservers = result.value
const registrar: string = (await whois(options.domain, true)).parsedData.Registrar

// usually for Route53 registered domains, we don't need to update create a hosted zone as it's already
// done for us. But in case it's not, we still need to ensure it's created before we can deploy
if (registrar.includes('Amazon')) {
  if (parsedOptions.deploy) {
    await runCommand('buddy deploy')
  }
  else {
    logger.log('')
    logger.log('You can now continue your deployment process by re-running:')
    logger.log('')
    logger.log(`  ➡️  ${italic('buddy deploy')}`)
    logger.log('')
  }
  process.exit(0)
}

logger.log('')
logger.log('ℹ️  Please note, before continuing your deployment process,')
logger.log(`   update your ${registrar} nameservers to the following:`)

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
