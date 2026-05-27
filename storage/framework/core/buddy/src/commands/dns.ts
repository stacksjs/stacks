import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log, onUnknownSubcommand } from "@stacksjs/cli"
import { config } from '@stacksjs/config'
import { ExitCode } from '@stacksjs/types'

// `@stacksjs/dnsx` currently publishes only type declarations (no
// `dist/index.js`), so a top-level `import { DnsClient, formatOutput
// } from '@stacksjs/dnsx'` blows up the entire commands barrel at
// module-load time. Defer the resolve until the user actually runs
// `buddy dns`, and surface a clean error if the runtime still isn't
// shipped — keeps the rest of the CLI loadable.

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
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('dns [domain]', descriptions.dns)
    .option('-q, --query <query>', descriptions.query)
    .option('-t, --type <type>', descriptions.type, { default: 'A' })
    .option('-n, --nameserver <nameserver>', descriptions.nameserver)
    .option('--class <class>', descriptions.class)
    // transport options
    .option('-U, --udp', descriptions.udp)
    .option('-T, --tcp', descriptions.tcp)
    .option('-S, --tls', descriptions.tls)
    .option('-H, --https', descriptions.https)
    // output options
    .option('-1, --short', descriptions.short, { default: false })
    .option('-J, --json', descriptions.json, { default: false })
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string | undefined, options: DnsOptions) => {
      log.debug('Running `buddy dns [domain]` ...', options)

      const targetDomain = domain || config.app.url

      let DnsClient: typeof import('@stacksjs/dnsx').DnsClient
      let formatOutput: typeof import('@stacksjs/dnsx').formatOutput
      try {
        const dnsx = await import('@stacksjs/dnsx') as typeof import('@stacksjs/dnsx')
        DnsClient = dnsx.DnsClient
        formatOutput = dnsx.formatOutput
      }
      catch (err) {
        log.error(
          `\`buddy dns\` needs the @stacksjs/dnsx runtime, but only the type declarations are currently published. `
          + `Install a build with the JS runtime (or wait for the next dnsx release) and re-run.`,
        )
        log.debug(`[dns] import failure: ${err instanceof Error ? err.message : String(err)}`)
        process.exit(ExitCode.FatalError)
      }

      try {
        const client = new DnsClient({
          domains: [targetDomain],
          type: options.type,
          nameserver: options.nameserver,
          class: options.class,
          udp: options.udp,
          tcp: options.tcp,
          tls: options.tls,
          https: options.https,
          short: options.short,
          json: options.json,
          verbose: options.verbose,
        })

        const startTime = performance.now()
        const responses = await client.query()
        const duration = performance.now() - startTime

        const output = formatOutput(responses, {
          json: options.json ?? false,
          short: options.short ?? false,
          showDuration: duration,
          colors: { enabled: true },
          rawSeconds: false,
        })

        console.log(output)
      }
      catch (error) {
        log.error(`DNS query failed: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "dns")
}
