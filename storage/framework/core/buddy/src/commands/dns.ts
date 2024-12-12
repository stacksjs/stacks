import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { ExitCode } from '@stacksjs/types'

// import { Action } from '@stacksjs/enums'
// import { runAction } from '@stacksjs/actions'

interface DnsOptions {
  query?: string
  type?: string
  nameserver?: string
  class?: string
  udp?: boolean
  tcp?: boolean
  tls?: boolean
  https?: boolean
  short?: boolean
  json?: boolean
  pretty?: boolean
  p?: boolean // short for pretty
  verbose?: boolean
}

export function dns(buddy: CLI): void {
  const descriptions = {
    dns: 'Lists the DNS records for a domain',
    query: 'Host name or IP address to query',
    type: 'Type of the DNS record being queried (A, MX, NS…)',
    nameserver: 'Address of the nameserver to send packets to',
    class: 'Network class of the DNS record being queried (IN, CH, HS)',
    udp: 'Use the DNS protocol over UDP',
    tcp: 'Use the DNS protocol over TCP',
    tls: 'Use the DNS-over-TLS protocol',
    https: 'Use the DNS-over-HTTPS protocol',
    short: 'Short mode: display nothing but the first result',
    json: 'Display the output as JSON',
    pretty: 'Display the output as JSON in a pretty format',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('dns [domain]', descriptions.dns)
    .option('-q, --query <query>', descriptions.query)
    .option('-t, --type <type>', descriptions.type, { default: 'ANY' })
    .option('-n, --nameserver <nameserver>', descriptions.nameserver)
    .option('--class <class>', descriptions.nameserver)
    // transport options
    .option('-U, --udp', descriptions.udp)
    .option('-T, --tcp', descriptions.tcp)
    .option('-S, --tls', descriptions.tls)
    .option('-H, --https', descriptions.https)
    // output options
    .option('-1, --short', descriptions.short, { default: false })
    .option('-J, --json', descriptions.json, { default: false })
    .option('-p, --pretty', descriptions.pretty, { default: true })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string | undefined, options: DnsOptions) => {
      log.debug('Running `buddy dns [domain]` ...', options)
      // let prettyOutput = false

      // if (options.json && options.pretty)
      //   prettyOutput = true

      options.pretty = undefined
      options.p = undefined

      // Convert options object to command-line options string
      const optionsString = Object.entries(options)
        .filter(([key, value]) => key !== '--' && key.length > 1 && value !== false) // filter out '--' key and short options
        .map(([key, value]) => `--${key} ${value}`)
        .join(' ')

      await runCommand(`dog ${domain || config.app.url} ${optionsString}`)

      process.exit(ExitCode.Success)
    })

  buddy.on('dns:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
