import { ExitCode } from '@stacksjs/types'
import type { CLI } from '@stacksjs/types'
import { config } from '@stacksjs/config'
// import { path } from '@stacksjs/path'
import { runCommandSync } from '@stacksjs/cli'

import { exec } from 'child_process'

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

type HttpOptions = {
  verbose?: boolean
}

export function http(buddy: CLI) {
  const descriptions = {
    http: 'Send an HTTP request to a domain',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('http [domain]', descriptions.http)
    // .option('--verbose', descriptions.verbose, { default: false })
    .action(async (domain: string | undefined, options: HttpOptions) => {
      // Convert options object to command-line options string
      const optionsString = Object.entries(options)
        .filter(([key, value]) => key !== '--' && key.length > 1 && value !== false) // filter out '--' key and short options
        .map(([key, value]) => `--${key} ${value}`)
        .join(' ')

      const command = `http GET ${domain || config.app.url } ${optionsString}`
      console.log(`Running command: ${command}`)
      runCommandSync(command)

      process.exit(ExitCode.Success)
    })
}
