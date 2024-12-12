import type { CLI, Ports, PortsOptions } from '@stacksjs/types'
import { $ } from 'bun'
import process from 'node:process'
import { intro, italic, outro } from '@stacksjs/cli'
import { ports as projectPorts } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { findProjectPath, path as p, projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { findStacksProjects } from '@stacksjs/utils'

export function ports(buddy: CLI): void {
  const descriptions = {
    command: 'Let buddy check your project for potential issues and misconfigurations',
    ports: 'Check if the ports are available',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  buddy
    .command('ports', descriptions.command)
    .option('-l, --list', 'List the used ports', { default: true })
    .option('-c, --check', 'Check if the ports are available', {
      default: false,
    })
    .option('-p, --project [name]', descriptions.project, {
      default: undefined,
    })
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: PortsOptions) => {
      log.debug('Running `buddy ports` ...', options)

      let perf
      if (!options.quiet)
        perf = await intro('buddy ports')

      if (options.project) {
        const path = await findProjectPath(options.project)
        log.debug(`Path: ${path}`)

        const ports = await getPortsForProjectPath(path, options)
        log.debug(`./buddy ports --quiet response for ${projectPath}`, ports)

        outputPorts(ports, options)
      }

      // use the user config ports
      else {
        outputPorts(projectPorts, options)
      }

      if (!options.quiet)
        await outro('Exited', { startTime: perf, useSeconds: false })

      process.exit(ExitCode.Success)
    })

  buddy
    .command('ports:list', descriptions.ports)
    .option('-p, --project [name]', descriptions.project, {
      default: undefined,
    })
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: PortsOptions) => {
      log.debug('Running `buddy ports:list` ...', options)

      let perf
      if (!options.quiet)
        perf = await intro('buddy ports:list')

      // return the ports for the project
      if (options.project) {
        if (!options.quiet)
          log.info(`Listing ports for project: ${italic(options.project)}`)

        const path = await findProjectPath(options.project)

        log.debug(`Path: ${path}`)

        const ports = await getPortsForProjectPath(path, options)

        outputPorts(ports, options)
      }
      // return the used ports for all projects
      else {
        outputPorts(projectPorts, options)
      }

      if (!options.quiet)
        await outro('Exited', { startTime: perf, useSeconds: false })

      process.exit(ExitCode.Success)
    })

  buddy
    .command('ports:check', descriptions.ports)
    .option('-p, --project [name]', descriptions.project, {
      default: projectPath(),
    })
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: PortsOptions) => {
      log.debug('Running `buddy ports:check` ...', options)

      let perf
      if (!options.quiet)
        perf = await intro('buddy ports:check')

      const projects = await findStacksProjects(undefined, { quiet: true })

      log.debug('Running `buddy ports`')
      log.debug(`Found ${projects.length} projects`)
      log.debug('Projects:', projects)

      // need to loop over the projects and then trigger `buddy ports` for each project (which returns a list of ports)
      const projectsPorts: { [project: string]: Ports } = {}
      for (const project of projects) projectsPorts[project] = await getPortsForProjectPath(project, options)

      log.info('ProjectsPorts:', projectsPorts)

      if (!options.quiet)
        await outro('Exited', { startTime: perf, useSeconds: false })

      process.exit(ExitCode.Success)
    })

  buddy.on('ports:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', buddy.args.join(' '))
    process.exit(1)
  })
}

async function getPortsForProjectPath(path: string, options: PortsOptions) {
  if (!options.quiet)
    log.info(`Checking ports for project: ${italic(path)}`)

  $.cwd(path)
  // load the .env file for the project
  $.env(await import(`${path}/.env`))

  const projectList = await $`./buddy projects:list --quiet`.text()
  log.debug('ProjectListResponse', projectList)

  // get the list of all Stacks project paths (on the system)
  const projects = projectList
    .split('\n')
    .filter(line => line.startsWith('   - '))
    .map(line => line.trim().substring(4))
  log.debug('Projects:', projects)

  // since we are targeting a specific project, find its path
  const ppath = options.project ?? p.projectPath()
  let projectPath = projects.find(project => project.includes(ppath))

  log.debug(`Checking ports for project: ${projectPath}`)
  if (projectPath === '' || !projectPath)
    // default to the current project
    projectPath = p.projectPath()

  log.debug(`$ Running: ./buddy ports:list --quiet via ${projectPath}`)
  const response = await $`./buddy ports:list --quiet`.json()

  log.debug(`Response for ./buddy ports:list --quiet via ${projectPath}`, response)

  // Step 1: Add double quotes around keys
  let validJsonString = response.replace(/(\w+)(?=\s*:)/g, '"$1"')

  // Step 2: Remove potential trailing commas before closing braces
  validJsonString = validJsonString.replace(/,(\s*\})/g, '$1')

  // Now we can parse it into an object
  const ports = JSON.parse(validJsonString) as Ports

  log.debug(`Ports for ${projectPath}`, ports)

  return ports
}

function outputPorts(ports: Ports, options: PortsOptions) {
  if (!options.quiet)
    console.log('')

  console.log(ports)

  if (!options.quiet)
    console.log('')
}
