import type { CLI, Ports, PortsOptions } from '@stacksjs/types'
import { connect } from 'node:net'
import process from 'node:process'
import { dim, green, intro, onUnknownSubcommand, outro, yellow } from '@stacksjs/cli'
import { ports as projectPorts } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy ports` - the ports this project's servers use.
 *
 * `--project <name>` works here the way it does on every command: the launcher
 * (`../launcher.ts`) starts the command in that project, so by the time this
 * runs `@stacksjs/config` is already that project's. This file used to do it
 * by hand, running `./buddy projects:list` and `./buddy ports:list` in the
 * other project and rewriting the object each printed back into JSON.
 */

/** Whether something is listening on the port on this machine. */
function isListening(port: number, timeoutMs = 300): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = connect({ port, host: '127.0.0.1' })
    const finish = (listening: boolean): void => {
      clearTimeout(timer)
      socket.destroy()
      resolve(listening)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

function outputPorts(ports: Ports, options: PortsOptions) {
  if (!options.quiet)
    console.log('')

  console.log(ports)

  if (!options.quiet)
    console.log('')
}

async function checkPorts(ports: Ports): Promise<void> {
  const entries = Object.entries(ports).filter((entry): entry is [string, number] => typeof entry[1] === 'number')
  const width = Math.max(...entries.map(([name]) => name.length))
  const listening = await Promise.all(entries.map(([, port]) => isListening(port)))

  entries.forEach(([name, port], index) => {
    const state = listening[index] ? yellow('in use') : green('free')
    console.log(`  ${name.padEnd(width)}  ${dim(String(port).padStart(5))}  ${state}`)
  })
}

export function ports(buddy: CLI): void {
  const descriptions = {
    command: 'List the ports this project\'s servers use',
    check: 'Check which of this project\'s ports are free and which are in use',
    project: 'Target a specific project',
    verbose: 'Enable verbose output',
  }

  for (const name of ['ports', 'ports:list']) {
    const command = buddy
      .command(name, descriptions.command)
      .option('-p, --project [name]', descriptions.project, { default: undefined })
      .option('-q, --quiet', 'Use minimal output', { default: false })
      .option('--verbose', descriptions.verbose, { default: false })

    if (name === 'ports')
      command.option('-c, --check', descriptions.check, { default: false })

    command.action(async (options: PortsOptions & { check?: boolean }) => {
      log.debug(`Running \`buddy ${name}\` ...`, options)

      let perf
      if (!options.quiet)
        perf = await intro(`buddy ${name}`)

      if (options.check)
        await checkPorts(projectPorts)
      else
        outputPorts(projectPorts, options)

      if (!options.quiet)
        await outro('Exited', { startTime: perf, useSeconds: false })

      process.exit(ExitCode.Success)
    })
  }

  buddy
    .command('ports:check', descriptions.check)
    .option('-p, --project [name]', descriptions.project, { default: undefined })
    .option('-q, --quiet', 'Use minimal output', { default: false })
    .option('--verbose', descriptions.verbose, { default: false })
    .action(async (options: PortsOptions) => {
      log.debug('Running `buddy ports:check` ...', options)

      let perf
      if (!options.quiet)
        perf = await intro('buddy ports:check')

      await checkPorts(projectPorts)

      if (!options.quiet)
        await outro('Exited', { startTime: perf, useSeconds: false })

      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, 'ports')
}
