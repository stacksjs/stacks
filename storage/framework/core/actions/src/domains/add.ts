import process from 'node:process'
import { italic, log, parseOptions, runCommand } from '@stacksjs/cli'
import { createHostedZone, getHostedZoneNameservers, updateNameservers } from '@stacksjs/dns'
import { loadEnv } from '@stacksjs/env'
import { handleError } from '@stacksjs/error-handling'
import { projectConfigPath } from '@stacksjs/path'
import { whois } from '@stacksjs/whois'

// Load environment variables including production settings BEFORE importing config
loadEnv({
  path: ['.env', '.env.production'],
  overload: true,
})

const options = parseOptions()

// Helper to normalize domain (strip protocol and trailing slash)
function normalizeDomain(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url
    .replace(/^https?:\/\//, '') // Remove http:// or https://
    .replace(/\/$/, '') // Remove trailing slash
}

// Use process.env.APP_URL directly to ensure we get the production value
const domain = normalizeDomain((options.domain as string | undefined) ?? process.env.APP_URL)

if (!domain) {
  log.error(
    'There was no Domain or App URL provided. Please provide a domain using the --domain flag or add a url to your app config.',
  )
  process.exit(1)
}

const result = await createHostedZone(domain)

if (result.isErr) {
  handleError(result.error)
  process.exit(1)
}

// Get nameservers from the hosted zone's delegation set
const nameServers = await getHostedZoneNameservers(domain)

if (!nameServers || nameServers.length === 0) {
  handleError(`No nameservers found for domain: ${domain}. Please ensure the Hosted Zone exists in Route53.`)
  process.exit(1)
}

await updateNameservers(nameServers)

const registrar: string = (await whois(domain, true)).parsedData.Registrar

// usually for Route53 registered domains, we don't need to update create a hosted zone as it's already
// done for us. But in case it's not, we still need to ensure it's created before we can deploy
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
