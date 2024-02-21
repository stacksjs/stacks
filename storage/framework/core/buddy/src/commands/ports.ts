import process from 'node:process'
import type { CLI, CheckOptions } from '@stacksjs/types'
import { ExitCode } from '@stacksjs/types'
import { ports as projectPorts } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { $ } from 'bun'
import { intro, italic, outro } from 'stacks/cli'

export function ports(buddy: CLI) {
  const descriptions = {
    command: 'Let buddy check your project for potential issues and misconfigurations',
    ports: 'Check if the ports are available',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('ports', descriptions.command)
    .option('-p, --project [name]', descriptions.project, { default: '' })
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: CheckOptions) => {
      log.debug('Running `buddy ports` ...', options)

      let perf
      if (!options.quiet)
        perf = await intro('buddy ports')

      if (options.project) {
        if (!options.quiet)
          log.info(`Checking ports for project: ${italic(options.project)}`)

        const projectList = await $`./buddy projects:list --quiet`.text()
        log.debug('projectList', projectList)

        const projects = projectList.split('\n').filter(line => line.startsWith('   - ')).map(line => line.trim().substring(4))
        log.debug('projects', projects)

        const projectPath = projects.find(project => project.includes(options.project as string)) || ''
        log.debug('projectPath', projectPath)

        $.cwd(projectPath.startsWith('/') ? projectPath : `/${projectPath}`)

        const res = (await $`./buddy ports --quiet`.text()).trim()
        log.debug(`./buddy ports --quiet response for ${projectPath}`, res)

        // eslint-disable-next-line no-console
        console.log('')
        // eslint-disable-next-line no-console
        console.log(res)
        // eslint-disable-next-line no-console
        console.log('')
      }
      else {
        // eslint-disable-next-line no-console
        console.log('')
        // eslint-disable-next-line no-console
        console.log(projectPorts)
        // eslint-disable-next-line no-console
        console.log('')
      }

      if (!options.quiet)
        await outro('Exited', { startTime: perf, useSeconds: true })

      process.exit(ExitCode.Success)
    })

  buddy.on('ports:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}
