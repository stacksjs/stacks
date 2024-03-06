import process from 'node:process'
import { createHostedZone, getNameservers, updateNameservers } from '@stacksjs/dns'
import { app } from '@stacksjs/config'
import { italic, log, parseOptions, runCommand } from '@stacksjs/cli'
import { whois } from '@stacksjs/whois'
import { logger } from '@stacksjs/logging'
import { projectConfigPath } from '@stacksjs/path'

const options = parseOptions()
const domain = (options.domain as string | undefined) ?? app.url

if (!domain) {
  log.error('There was no Domain or App URL provided. Please provide a domain using the --domain flag or add a url to your app config.')
  process.exit(1)
}

const result = await createHostedZone(domain)

if (result.isErr()) {
  handleError(result.error)
  process.exit(1)
}

// Update the nameservers
const nameServers = await getNameservers(domain)

if (!nameServers) {
  handleError(`No nameservers found for domain: ${domain}. Please ensure the Hosted Zone exists in Route53.`)
  process.exit(1)
}

await updateNameservers(nameServers)

const registrar: string = (await whois(domain, true)).parsedData.Registrar

// usually for Route53 registered domains, we don't need to update create a hosted zone as it’s already
// done for us. But in case it’s not, we still need to ensure it’s created before we can deploy
if (registrar.includes('Amazon')) {
  if (options.deploy) {
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
nameServers.forEach((nameserver: string, index: number) => {
  logger.log(`  ${emojis[index]}  Nameserver: ${nameserver}`)
})
logger.log('')
logger.log(italic(`stored in ${projectConfigPath('dns.ts')}`))
logger.log('')
logger.log('Once the nameservers have been updated, re-run the following command:')
logger.log('')
logger.log(`  ➡️  ${italic('buddy deploy')}`)
logger.log('')
