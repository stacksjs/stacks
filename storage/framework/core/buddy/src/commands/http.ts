import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { log } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { HttxClient } from '@stacksjs/httx'
import { ExitCode } from '@stacksjs/types'

interface HttpOptions {
  verbose?: boolean
}

export function http(buddy: CLI): void {
  const descriptions = {
    http: 'Send an HTTP request to a domain',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('http [domain]', descriptions.http)
    .option('-p, --project [project]', descriptions.project, { default: false })
    .option('-v, --verbose', descriptions.verbose, { default: false })
    .action(async (domain: string | undefined, options: HttpOptions) => {
      log.debug('Running `buddy http [domain]` ...', options)

      const url = domain || config.app.url
      const client = new HttxClient({ verbose: options.verbose })

      log.info(`GET ${url}`)

      const result = await client.request(url.startsWith('http') ? url : `https://${url}`, {
        method: 'GET',
      })

      result.match({
        ok: (response) => {
          log.info(`${response.status} ${response.statusText} (${response.timings.duration.toFixed(0)}ms)`)
          console.log(typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2))
          process.exit(ExitCode.Success)
        },
        err: (error) => {
          log.error(`Request failed: ${error.message}`)
          process.exit(ExitCode.FatalError)
        },
      })
    })
}
