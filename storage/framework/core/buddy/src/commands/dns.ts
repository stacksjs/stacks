import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log, onUnknownSubcommand } from "@stacksjs/cli"
import { config } from '@stacksjs/config'
import { renderDnsConfig, resolveLiveRecords, syncDnsConfig } from '@stacksjs/dns'
import { ExitCode } from '@stacksjs/types'
import { loadProjectDnsConfig } from '../config'

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
          domains: [targetDomain!],
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
        await log.error(`DNS query failed: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(ExitCode.FatalError)
      }

      process.exit(ExitCode.Success)
    })

  // Strip protocol/path/port from a configured app URL down to a bare zone.
  const bareDomain = (input?: string): string =>
    (input || config.app.url || '').replace(/^[a-z]+:\/\//i, '').replace(/[/:].*$/, '')

  buddy
    .command('dns:pull [domain]', 'Print a domain\'s live DNS records as a config/dns.ts block')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string | undefined, options: { verbose?: boolean }) => {
      const target = bareDomain(domain)
      log.debug(`Running \`buddy dns:pull ${target}\` ...`, options)

      const records = await resolveLiveRecords(target)
      if (!records.length) {
        await log.error(`No DNS records resolved for ${target}.`)
        process.exit(ExitCode.FatalError)
      }

      console.log(renderDnsConfig(target, records))
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dns:diff [domain]', 'Show which config/dns.ts records are missing from the live zone')
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string | undefined, options: { verbose?: boolean }) => {
      const target = bareDomain(domain)
      log.debug(`Running \`buddy dns:diff ${target}\` ...`, options)

      const dnsConfig = await loadProjectDnsConfig(config.dns)
      const { plan, provider } = await syncDnsConfig(target, dnsConfig, { dryRun: true })
      for (const item of plan.items) {
        const detail = item.record.type === 'TXT' || item.record.type === 'MX' ? ` ${item.record.content}` : ` → ${item.record.content}`
        const label = item.action === 'create' ? '+ create' : item.action === 'skip' ? '- skip  ' : '  keep  '
        // The reason belongs on the line: a record shown as skipped with no
        // explanation is the same puzzle as one silently dropped.
        const why = item.action === 'skip' ? `  (${item.reason})` : ''
        console.log(`  ${label} ${item.record.type.padEnd(5)} ${item.record.name}${detail}${why}`)
      }
      const skipped = plan.skip.length ? `, ${plan.skip.length} unpublishable` : ''
      console.log(`\n${plan.create.length} to create, ${plan.keep.length} already present${skipped} (${provider ? `registrar: ${provider}` : 'public DNS'})`)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('dns:sync [domain]', 'Additively sync config/dns.ts to the registrar (creates missing records; never deletes or overwrites)')
    .option('--dry-run', 'Show the plan without writing any records', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string | undefined, options: { dryRun?: boolean, verbose?: boolean }) => {
      const target = bareDomain(domain)
      log.debug(`Running \`buddy dns:sync ${target}\` ...`, options)

      const dnsConfig = await loadProjectDnsConfig(config.dns)
      const result = await syncDnsConfig(target, dnsConfig, { dryRun: options.dryRun })

      if (!result.provider && !options.dryRun) {
        log.warn(`No DNS provider credentials found (e.g. PORKBUN_API_KEY / PORKBUN_SECRET_KEY) - nothing was synced. ${result.plan.create.length} record(s) would be created.`)
        process.exit(ExitCode.Success)
      }

      // Print the outcome per record, not the plan: this used to say "created"
      // for every record it attempted, including the ones the registrar refused
      // on the very same run.
      const failedNames = new Set(result.failures.map(failure => `${failure.record.type} ${failure.record.name}`))
      for (const record of result.plan.create) {
        const verb = !result.applied ? 'would create' : failedNames.has(`${record.type} ${record.name}`) ? 'FAILED ' : 'created'
        console.log(`  ${verb} ${record.type.padEnd(5)} ${record.name} → ${record.content}`)
      }
      for (const failure of result.failures)
        console.log(`    ${failure.record.type} ${failure.record.name}: ${failure.reason}`)
      for (const skipped of result.skipped)
        console.log(`  skipped ${skipped.record.type.padEnd(5)} ${skipped.record.name}: ${skipped.reason}`)

      const verb = result.applied ? 'created' : 'to create'
      const count = result.applied ? result.created : result.plan.create.length
      const skippedNote = result.skipped.length ? `, ${result.skipped.length} unpublishable` : ''
      console.log(`\ndns:sync ${target}: ${count} ${verb}, ${result.kept} kept${result.failed ? `, ${result.failed} failed` : ''}${skippedNote}${result.provider ? ` (${result.provider})` : ''}`)
      process.exit(result.failed > 0 ? ExitCode.FatalError : ExitCode.Success)
    })

  onUnknownSubcommand(buddy, "dns")
}
