import type { CLI } from '@stacksjs/types'
import process from 'node:process'
// import { path } from '@stacksjs/path'
import { log, runCommandSync } from '@stacksjs/cli'
import { config } from '@stacksjs/config'

import { ExitCode } from '@stacksjs/types'

// function runCommand(command: string): Promise<string> {
//   return new Promise((resolve, reject) => {
//     exec(command, { shell: true, cwd: path.projectPath() }, (error, stdout, stderr) => {
//       if (error) {
//         console.error(`exec error: ${error}`)
//         reject(error)
//       } else {
//         console.log(error, stdout, stderr)
//         resolve(stdout)
//       }
//     })
//   })
// }

// import { Action } from '@stacksjs/enums'
// import { runAction } from '@stacksjs/actions'

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
    // .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string | undefined, options: HttpOptions) => {
      log.debug('Running `buddy http [domain]` ...', options)

      // Convert options object to command-line options string
      const optionsString = Object.entries(options)
        .filter(([key, value]) => key !== '--' && key.length > 1 && value !== false) // filter out '--' key and short options
        .map(([key, value]) => `--${key} ${value}`)
        .join(' ')

      const command = `http GET ${domain || config.app.url} ${optionsString}`

      log.info(`Running command: ${command}`)
      await runCommandSync(command)

      process.exit(ExitCode.Success)
    })
}
