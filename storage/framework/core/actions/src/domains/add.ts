import process from 'node:process'
import { italic, log, parseOptions, runCommand } from '@stacksjs/cli'
import { app } from '@stacksjs/config'
import { createHostedZone, getNameservers, updateNameservers } from '@stacksjs/dns'
import { handleError } from '@stacksjs/error-handling'
import { projectConfigPath } from '@stacksjs/path'
import { whois } from '@stacksjs/whois'

const options = parseOptions()
const domain = (options.domain as string | undefined) ?? app.url

if (!domain) {
  log.error(
    'There was no Domain or App URL provided. Please provide a domain using the --domain flag or add a url to your app config.',
  )
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
    log.info('')
    log.info('You can now continue your deployment process by re-running:')
    log.info('')
    log.info(`  ➡️  ${italic('buddy deploy')}`)
    log.info('')
  }
  process.exit(0)
}

log.info('')
log.info('ℹ️  Please note, before continuing your deployment process,')
log.info(`   update your ${registrar} nameservers to the following:`)

const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣']
log.info('')
nameServers.forEach((nameserver: string, index: number) => {
  log.info(`  ${emojis[index]}  Nameserver: ${nameserver}`)
})
log.info('')
log.info(italic(`stored in ${projectConfigPath('dns.ts')}`))
log.info('')
log.info('Once the nameservers have been updated, re-run the following command:')
log.info('')
log.info(`  ➡️  ${italic('buddy deploy')}`)
log.info('')
