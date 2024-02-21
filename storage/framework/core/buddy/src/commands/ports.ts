import process from 'node:process'
import type { CLI, CheckOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { $ } from 'bun'

export function ports(buddy: CLI) {
  const descriptions = {
    command: 'Let buddy check your project for potential issues and misconfigurations',
    ports: 'Check if the ports are available',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('ports', descriptions.command)
    .option('-p, --project', descriptions.project, { default: false })
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CheckOptions) => {
      log.debug('Running `buddy ports` ...', options)

      await $`./buddy projects:list --quiet`

      // if (options.project) {
      //   log.info(`Checking ports for project ${options.project}`)
      //
      //   $.cwd(options.project)
      //   const res = (await $`./buddy ports --quiet`.text()).trim()
      //   console.log('res', res)
      //
      //   process.exit(0)
      // }

      // const perf = await intro('buddy ports')
      // const ports = config.ports
      // console.log('ports', ports)
      // const result = await runAction(Action.CheckPorts, options)
      //
      // if (result.isErr()) {
      //   log.error(result.error)
      //   process.exit(ExitCode.FatalError)
      // }

      // const otherPorts = result.value

      // console.log('result', result.value)
      //
      // await outro('Exited', { startTime: perf, useSeconds: true })
      process.exit(ExitCode.Success)
    })

  buddy.on('ports:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
