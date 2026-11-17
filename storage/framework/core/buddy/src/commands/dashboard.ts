import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { bold, cyan, dim, green } from '@stacksjs/cli'
import { findProject, findProjectRoot, listProjects, registerProject } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy dashboard [project]` - open a project's dashboard, from anywhere.
 *
 * The dashboard is started in the background if it is not up already and
 * stops itself once nobody has used it for a while, so there is no terminal
 * to keep open and nothing to shut down afterwards. From there, the project
 * switcher at the top of its sidebar reaches every other project.
 *
 * `buddy dev:dashboard` remains the foreground way: it runs the dashboard in
 * this terminal, with its native window, until it is stopped.
 */

function open(url: string): void {
  const command = process.platform === 'darwin'
    ? ['open', url]
    : process.platform === 'win32'
      ? ['cmd', '/c', 'start', '', url]
      : ['xdg-open', url]
  Bun.spawn(command, { stdout: 'ignore', stderr: 'ignore' }).unref()
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(ExitCode.FatalError)
}

/**
 * The project to open: the one named, else the one this directory is in, else
 * the one used most recently.
 */
function targetProject(name: string | undefined): string {
  if (name) {
    const match = findProject(name)
    if (match.candidates.length > 0)
      fail(`"${name}" matches more than one project: ${match.candidates.map(candidate => candidate.name).join(', ')}`)
    if (!match.project)
      fail(`No Stacks project matches "${name}". Run \`buddy projects\` to see the ones on this machine.`)
    return match.project.path
  }

  const here = findProjectRoot(process.cwd())
  if (here)
    return here

  const recent = listProjects()[0]
  if (!recent)
    fail('There is no Stacks project here, and none on this machine\'s list yet. Run this inside a project, or create one: buddy new my-app')
  return recent.path
}

export function dashboard(buddy: CLI): void {
  buddy
    .command('dashboard [project]', 'Open a project\'s dashboard, starting it in the background if needed')
    .option('-p, --project [project]', 'The project to open, by name or path')
    .option('--no-open', 'Start it and print its address without opening a browser')
    .option('--stop', 'Stop the project\'s background dashboard', { default: false })
    .action(async (name: string | undefined, options: { project?: string | boolean, open?: boolean, stop?: boolean }) => {
      const root = targetProject(name ?? (typeof options.project === 'string' ? options.project : undefined))
      const project = registerProject(root)
      const label = bold(project?.name ?? root)
      const { openProjectDashboard, stopProjectDashboard } = await import('@stacksjs/actions/daemon/client')

      if (options.stop) {
        console.log(await stopProjectDashboard(root)
          ? `Stopped the dashboard for ${label}.`
          : `${label} has no dashboard running in the background.`)
        process.exit(ExitCode.Success)
      }

      try {
        const { url, started } = await openProjectDashboard(root)
        console.log(`${green('➜')}  ${label}  ${cyan(url)}  ${dim(started ? 'started in the background' : 'already running')}`)
        if (options.open !== false)
          open(url)
      }
      catch (error) {
        fail((error as Error).message)
      }

      process.exit(ExitCode.Success)
    })
}
