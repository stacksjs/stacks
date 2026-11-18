import { accessSync, constants, realpathSync } from 'node:fs'
import { basename, join } from 'node:path'
import process from 'node:process'
import { findProject, findProjectRoot, isCompiledBinary, isVisitingCli, noteProjectUsed, projectCliEntry } from '@stacksjs/path'
import { isIsolatedRuntime, withoutIsolation } from './runtime-flags'

/**
 * One `buddy` for the whole machine.
 *
 * Before this, `buddy` was a file in a project and only worked from that
 * project's root: one directory down, it resolved the wrong root and refused
 * to run, and a `buddy` installed globally ran its own framework version
 * against whatever project it happened to stand in.
 *
 * Every invocation now starts by answering two questions.
 *
 * Which project? The one named with `--project`, else the one the working
 * directory is in, found by walking up. The 100 commands that declare
 * `-p, --project [project]` have always advertised the first; nothing
 * implemented it.
 *
 * Whose code runs it? The project's own `buddy` when it has one. A project
 * pins its framework version, and its migrations, generated types and build
 * are only right when the CLI is that version too, so an installed `buddy`
 * finds the project and then gets out of the way. A project with nothing
 * installed (a fresh clone, before `buddy install`) is run by this one.
 *
 * Either way the process that does the work starts in the project root,
 * because Bun reads `bunfig.toml`, and with it the preload that loads `.env`,
 * from the directory it starts in and nowhere else.
 */

/**
 * Commands that belong to the machine, not to a project: they list projects,
 * create one, or run the background daemon. They are never handed to a
 * project's own `buddy`, which may be a release that predates them, and they
 * run from wherever they were typed.
 */
const MACHINE_COMMANDS = ['new', 'create', 'projects', 'cd', 'daemon', 'dashboard']
/** `dashboard:install` is a project's feature switch, so only these two have machine subcommands. */
const MACHINE_COMMAND_GROUPS = ['projects:', 'daemon:']

export function isMachineCommand(command: string | undefined): boolean {
  if (command === undefined)
    return false

  return MACHINE_COMMANDS.includes(command) || MACHINE_COMMAND_GROUPS.some(group => command.startsWith(group))
}

/**
 * Built-in commands whose `-p` is something other than `--project`.
 * `tests/launcher.test.ts` reads the command sources and fails when this list
 * and they disagree.
 */
export const SHORT_P_IS_NOT_PROJECT = ['build', 'make', 'preview', 'serve', 'serve:api', 'share']

export interface ProjectSelector {
  /** What was typed after the flag. */
  value: string
  /** Index in `args` of the value, or of the `--flag=value` token holding it. */
  index: number
  /** The flag as typed when the value is attached to it (`--project=`), else null. */
  attached: string | null
}

/**
 * Find `--project <value>` in the arguments, in any of the forms the commands
 * accept: `--project shop`, `--project=shop`, `-p shop`, `-p=shop`.
 *
 * Only a built-in command is read this way. An application's own command may
 * give `--project` and `-p` any meaning it likes, and it runs in the project
 * it was typed in. Among the built-ins, a handful use `-p` for a port, and
 * everything after a bare `--` belongs to whatever the command passes it to
 * (`tsc --project`, for one).
 */
export function findProjectSelector(args: string[], builtInCommands: ReadonlySet<string>): ProjectSelector | null {
  const command = args[0]
  // The registry names a group by its base (`dev` registers `dev:dashboard`).
  if (command === undefined || !(builtInCommands.has(command) || builtInCommands.has(command.split(':')[0]!)))
    return null

  const flags = SHORT_P_IS_NOT_PROJECT.includes(command) ? ['--project'] : ['--project', '-p']

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '--')
      break

    for (const flag of flags) {
      if (arg === flag) {
        const value = args[index + 1]
        // `[project]` is optional: a bare flag selects nothing.
        if (value !== undefined && !value.startsWith('-'))
          return { value, index: index + 1, attached: null }
      }
      else if (arg.startsWith(`${flag}=`) && arg.length > flag.length + 1) {
        return { value: arg.slice(flag.length + 1), index, attached: flag }
      }
    }
  }

  return null
}

/**
 * `buddy --project shop migrate` as `buddy migrate --project shop`.
 *
 * In front of the command, `-p` can only mean the project, whatever the
 * command later does with a `-p` of its own (`serve -p` is a port), so it is
 * moved behind the command in its long form, where everything else reads it.
 * Without a command after it there is nothing to move it behind.
 */
export function projectAfterCommand(args: string[]): string[] {
  const first = args[0]
  if (first === '--project' || first === '-p') {
    const [, value, command, ...rest] = args
    if (value !== undefined && !value.startsWith('-') && command !== undefined && !command.startsWith('-'))
      return [command, '--project', value, ...rest]
    return args
  }

  const attached = first?.match(/^(?:--project|-p)=(.+)$/)
  if (attached && args[1] !== undefined && !args[1].startsWith('-'))
    return [args[1], '--project', attached[1]!, ...args.slice(2)]

  return args
}

function samePath(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b)
  }
  catch {
    return a === b
  }
}

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK)
    return true
  }
  catch {
    return false
  }
}

/**
 * What a project with nothing installed can still be asked: to install. Even
 * `help` and `list` cannot be answered there, because describing the commands
 * means loading them, and the project's own commands and models import
 * packages that are not there yet.
 */
function runsWithoutInstall(args: string[]): boolean {
  return args[0] === 'install'
}

export type Invocation
  /** Run in this process. `root` is the project it runs for, when there is one. */
  = | { kind: 'run', root: string | null, args: string[] }
  /** Replace this process with `command`, started in `root`. */
    | { kind: 'handoff', root: string, command: string[] }
  /** The project asked for cannot be determined. */
    | { kind: 'refuse', message: string }

export interface InvocationContext {
  args: string[]
  cwd: string
  /** The entry this process is running: `Bun.main`. */
  main: string
  /** `process.execArgv`, kept when this same entry is restarted in the root. */
  execArgv: string[]
  /** The project this process was already handed, when it was. */
  handedRoot?: string
  builtInCommands: ReadonlySet<string>
}

/**
 * Decide where this invocation runs. No side effects: `launch` carries the
 * decision out.
 */
export function planInvocation(context: InvocationContext): Invocation {
  const { cwd } = context
  const args = projectAfterCommand(context.args)
  const command = args[0]

  if (isMachineCommand(command))
    return { kind: 'run', root: findProjectRoot(cwd), args }

  // Typed in front of the command it was the project, for any command; an
  // application command's own `--project` is only left alone behind it.
  const selector = args !== context.args
    ? { value: args[2]!, index: 2, attached: null }
    : findProjectSelector(args, context.builtInCommands)
  let root: string | null
  let forwarded = args

  if (selector) {
    const match = findProject(selector.value, cwd)
    if (!match.project) {
      return {
        kind: 'refuse',
        message: match.candidates.length > 0
          ? `"${selector.value}" matches more than one Stacks project: ${match.candidates.map(project => project.name).join(', ')}. Name one of them in full, or give its path.`
          : `No Stacks project matches "${selector.value}". Run \`buddy projects\` to see the ones on this machine, or give a path.`,
      }
    }

    root = match.project.path
    // The selector is spent here. Whatever runs the command starts in the
    // root, which is what every command that reads `--project` falls back to.
    // Forwarding it would hand the option to a project's own `buddy`, and one
    // released before this launcher resolves it its own way: by running a
    // `buddy` from PATH, which crashes where there is none.
    forwarded = selector.attached ? args.toSpliced(selector.index, 1) : args.toSpliced(selector.index - 1, 2)
  }
  else {
    root = findProjectRoot(cwd)
  }

  if (!root)
    return { kind: 'run', root: null, args }

  // A project with nothing installed has no `buddy` of its own, and its code
  // (commands, models, config) imports packages that are not there. Run by
  // this one, every such import would go to Bun's runtime auto-install and
  // come back at whatever version it picked, so the command would run against
  // a framework the project never asked for. Installing is the one thing to
  // do there.
  if (projectCliEntry(root) === null && !runsWithoutInstall(forwarded)) {
    const name = basename(root)
    return {
      kind: 'refuse',
      message: `${name} has nothing installed yet, so it has no buddy of its own to run this. Install its dependencies first:\n\n  buddy install --project ${name}\n`,
    }
  }

  // Started the way the published executable starts, without the config of
  // the directory it was typed in (see `runtime-flags.ts`), and the project
  // has a CLI of its own: whichever CLI ends up running this needs the
  // project's config. With nothing installed, the project's config only
  // preloads packages that are not there, and the isolation stays.
  const projectHasCli = projectCliEntry(root) !== null
  const needsProjectConfig = projectHasCli && isIsolatedRuntime(context.execArgv)

  // A process this launcher already started for this root is where it should
  // be. Checked before the entries are compared, so a layout the comparison
  // misjudges costs one extra start and not an endless one.
  if (context.handedRoot && samePath(context.handedRoot, root) && samePath(cwd, root) && !needsProjectConfig)
    return { kind: 'run', root, args: forwarded }

  if (isVisitingCli(root, context.main)) {
    // The project's shim knows which Bun and which module roots it runs with.
    const shim = join(root, 'buddy')
    return {
      kind: 'handoff',
      root,
      command: isExecutable(shim) ? [shim, ...forwarded] : [process.execPath, projectCliEntry(root)!, ...forwarded],
    }
  }

  // This is the project's own CLI (or the project has none, for `install`).
  if (!samePath(cwd, root) || needsProjectConfig) {
    // A compiled binary is its own entry; anything else is Bun running one.
    const execArgv = projectHasCli ? withoutIsolation(context.execArgv) : context.execArgv
    const self = isCompiledBinary(context.main) ? [process.execPath] : [process.execPath, ...execArgv, context.main]
    return { kind: 'handoff', root, command: [...self, ...forwarded] }
  }

  return { kind: 'run', root, args: forwarded }
}

/** The environment variable that tells a started process which root it was handed. */
export const HANDED_ROOT_ENV = 'STACKS_BUDDY_ROOT'

/**
 * Become `command`, in `root`.
 *
 * The process is replaced rather than given a child: a `buddy dev` that runs
 * for hours would otherwise keep a second, idle Bun alive beside it just to
 * relay its exit code. Where the platform cannot replace a process, a child
 * is the fallback, with its signals and exit code passed through.
 */
function handOff(root: string, command: string[]): never {
  const env = { ...process.env, [HANDED_ROOT_ENV]: root } as Record<string, string>
  process.chdir(root)

  if (typeof process.execve === 'function')
    process.execve(command[0]!, command, env)

  const child = Bun.spawnSync(command, { cwd: root, env, stdin: 'inherit', stdout: 'inherit', stderr: 'inherit' })
  process.exit(child.exitCode ?? 1)
}

/**
 * Settle the project for this invocation. Returns when this process is the
 * one that runs the command, with `process.argv` carrying what it should
 * parse; otherwise it does not return.
 */
export function launch(context: InvocationContext): { root: string | null, projectInstalled: boolean } {
  const invocation = planInvocation(context)

  if (invocation.kind === 'refuse') {
    process.stderr.write(`${invocation.message}\n`)
    process.exit(1)
  }

  // Seen once, a project is on the machine's list from then on: that is what
  // `buddy projects`, `--project <name>` and the dashboard's switcher read.
  // A temporary clone or a worktree is not (see `isTransientCheckout`).
  if (invocation.root)
    noteProjectUsed(invocation.root)

  if (invocation.kind === 'handoff')
    handOff(invocation.root, invocation.command)

  if (invocation.args.length !== context.args.length || invocation.args.some((arg, index) => arg !== context.args[index]))
    process.argv.splice(2, process.argv.length, ...invocation.args)

  return {
    root: invocation.root,
    // False only for a project with nothing installed, which this process is
    // running because the command is one that loads none of its code.
    projectInstalled: invocation.root === null || projectCliEntry(invocation.root) !== null,
  }
}
