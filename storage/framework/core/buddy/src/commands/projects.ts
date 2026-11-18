import type { CLI } from '@stacksjs/types'
import type { RegisteredProject } from '@stacksjs/path'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import process from 'node:process'
import { bold, dim, green, onUnknownSubcommand } from '@stacksjs/cli'
import { findProject, findProjectRoot, forgetProject, isProjectRoot, isTransientCheckout, listProjects, pruneProjects, readProjectService, registerProject } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy projects` - the Stacks projects on this machine.
 *
 * Reads the machine's project list (`@stacksjs/path`), which a project joins
 * the first time `buddy` runs in it, so this answers at once. It used to walk
 * the whole home directory on every call, for several seconds, and only found
 * projects that vendor the framework.
 */

interface ListOptions {
  quiet?: boolean
  json?: boolean
}

function shortPath(path: string): string {
  const home = homedir()
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

function printProjects(options: ListOptions): void {
  const projects = listProjects()

  if (options.json) {
    const rows = projects.map(project => ({
      ...project,
      exists: isProjectRoot(project.path),
      dashboard: readProjectService(project.path, 'dashboard')?.url ?? null,
    }))
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`)
    return
  }

  // One path per line and nothing else, for a script or a pipe into fzf.
  if (options.quiet) {
    for (const project of projects)
      process.stdout.write(`${project.path}\n`)
    return
  }

  if (projects.length === 0) {
    console.log('No Stacks projects on this machine\'s list yet.')
    console.log(dim('A project joins it the first time buddy runs inside it. To add the ones already on disk: buddy projects:scan'))
    return
  }

  const width = Math.max(...projects.map(project => project.name.length))
  for (const project of projects) {
    const dashboard = readProjectService(project.path, 'dashboard')
    const state = !isProjectRoot(project.path)
      ? dim('  missing')
      : dashboard ? `  ${green('●')} ${dashboard.url}` : ''
    console.log(`  ${bold(project.name.padEnd(width))}  ${dim(shortPath(project.path))}${state}`)
  }
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`)
  process.exit(ExitCode.FatalError)
}

/** The one listed project a name or path means, or exit saying why not. */
function listedProject(query: string): RegisteredProject {
  const match = findProject(query)
  if (match.candidates.length > 0)
    fail(`"${query}" matches more than one project: ${match.candidates.map(candidate => candidate.name).join(', ')}`)

  const listed = match.project && listProjects().find(project => project.path === match.project!.path)
  if (!listed)
    fail(`No project on the list matches "${query}".`)

  return listed
}

export function projects(buddy: CLI): void {
  const descriptions = {
    list: 'List the Stacks projects on this machine',
    add: 'Add a Stacks project to this machine\'s list',
    remove: 'Take a project off this machine\'s list (the project itself is not touched)',
    scan: 'Find Stacks projects under a directory and add them to the list',
    prune: 'Drop listed projects whose directory is gone',
    quiet: 'Print only the paths, one per line',
    json: 'Print the list as JSON',
  }

  for (const name of ['projects', 'projects:list']) {
    buddy
      .command(name, descriptions.list)
      .option('-q, --quiet', descriptions.quiet, { default: false })
      .option('--json', descriptions.json, { default: false })
      .action((options: ListOptions) => {
        printProjects(options)
        process.exit(ExitCode.Success)
      })
  }

  buddy
    .command('projects:add [path]', descriptions.add)
    .action((path: string | undefined) => {
      // Anywhere inside the project will do, the way it does for `buddy`.
      const root = findProjectRoot(resolve(path ?? process.cwd()))
      const project = root ? registerProject(root) : null
      if (!project)
        fail(`There is no Stacks project at ${resolve(path ?? process.cwd())}.`)

      console.log(`Added ${bold(project.name)} ${dim(shortPath(project.path))}`)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('projects:remove <name>', descriptions.remove)
    .alias('projects:forget')
    .action((name: string) => {
      const project = listedProject(name)
      forgetProject(project)
      console.log(`Removed ${bold(project.name)} from the list. ${dim(shortPath(project.path))} was not touched.`)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('projects:scan [dir]', descriptions.scan)
    .option('--depth <levels>', 'How many levels below the directory to look', { default: 6 })
    .action(async (dir: string | undefined, options: { depth?: number | string }) => {
      const { findStacksProjects } = await import('@stacksjs/utils')
      const known = new Set(listProjects({ includeMissing: true }).map(project => project.path))
      const discovered = await findStacksProjects(dir ? resolve(dir) : undefined, { quiet: true, maxDepth: Number(options.depth) || 6 })
      // A worktree or a temporary clone is a copy of a project, not one of its
      // own (`isTransientCheckout`); `buddy projects:add` lists one on purpose.
      const found = discovered.filter(root => !isTransientCheckout(root))
      const copies = discovered.length - found.length

      // Found is not used: a project the scan turns up is listed below the
      // ones that have actually been worked in, until it is.
      const neverUsed = new Date(0)
      const added = found
        .map(root => registerProject(root, neverUsed))
        .filter((project): project is RegisteredProject => project !== null && !known.has(project.path))

      for (const project of added)
        console.log(`  ${green('+')} ${bold(project.name)}  ${dim(shortPath(project.path))}`)
      console.log(`Found ${found.length} ${found.length === 1 ? 'project' : 'projects'}, ${added.length} new.${copies > 0 ? dim(` Left out ${copies} git ${copies === 1 ? 'worktree' : 'worktrees'} and temporary ${copies === 1 ? 'checkout' : 'checkouts'}.`) : ''}`)
      process.exit(ExitCode.Success)
    })

  buddy
    .command('projects:prune', descriptions.prune)
    .action(() => {
      const removed = pruneProjects()
      for (const project of removed)
        console.log(`  ${dim('-')} ${project.name}  ${dim(shortPath(project.path))}`)
      console.log(removed.length === 0 ? 'Every listed project is still there.' : `Removed ${removed.length} from the list.`)
      process.exit(ExitCode.Success)
    })

  onUnknownSubcommand(buddy, 'projects')
}
