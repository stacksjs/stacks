import type { CLI } from '@stacksjs/types'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { log, onUnknownSubcommand } from '@stacksjs/cli'

interface XRayCommandOptions {
  project?: string | false
  url?: string
  port?: string
  craftBin?: string
  window?: boolean
}

export function xRay(buddy: CLI): void {
  buddy
    .command('x-ray', 'Open native Craft diagnostics for this Stacks project')
    .alias('xray')
    .option('-p, --project [project]', 'Stacks project directory', { default: false })
    .option('--url [url]', 'Pretty application URL')
    .option('--port [port]', 'Internal diagnostics port')
    .option('--craft-bin [path]', 'Craft binary path')
    .option('--no-window', 'Start diagnostics without opening Craft')
    .action(async (options: XRayCommandOptions) => {
      const projectDirectory = path.resolve(typeof options.project === 'string' ? options.project : process.cwd())
      const command = xRayLaunchCommand(options, projectDirectory)
      log.info(`Starting Stacks X-Ray for ${projectDirectory}`)

      const child = Bun.spawn(command, {
        cwd: projectDirectory,
        stdin: 'inherit',
        stdout: 'inherit',
        stderr: 'inherit',
      })
      const exitCode = await child.exited
      if (exitCode !== 0)
        process.exit(exitCode)
    })

  onUnknownSubcommand(buddy, 'x-ray')
}

export function xRayLaunchCommand(
  options: XRayCommandOptions,
  projectDirectory: string,
  localCli = path.join(homedir(), 'Code/x-ray/src/cli.ts'),
): string[] {
  const command = existsSync(localCli)
    ? [process.execPath, localCli]
    : ['bunx', '--bun', '@stacksjs/x-ray']
  command.push('--project', projectDirectory)
  if (options.url) command.push('--url', options.url)
  if (options.port) command.push('--port', options.port)
  if (options.craftBin) command.push('--craft-bin', options.craftBin)
  if (options.window === false) command.push('--no-window')
  return command
}

