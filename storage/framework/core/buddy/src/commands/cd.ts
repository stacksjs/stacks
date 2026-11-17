import type { CLI } from '@stacksjs/types'
import process from 'node:process'
import { findProject } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

/**
 * `buddy cd <name>` — resolve the absolute path of a Stacks project by name.
 *
 * A child process can't mutate its parent shell's cwd, so this command
 * prints the resolved path to stdout rather than calling `chdir()`. Users
 * who want true `cd` behavior add a shell wrapper to their rc:
 *
 *   bcd() { eval "$(buddy cd "$1" --eval)"; }
 *
 * Then `bcd my-project` actually changes the shell's directory.
 *
 * The name is looked up on the machine's project list (`buddy projects`),
 * which answers at once. This used to walk the home directory on every call;
 * `--root` now names a directory to look in for a project that is not on the
 * list yet.
 *
 * stacksjs/stacks#527.
 */
export function cd(buddy: CLI): void {
  buddy
    .command('cd [name]', 'Print the absolute path of a Stacks project by name')
    .option('--eval', 'Emit `cd "path"` instead of just the path - pair with `eval "$(buddy cd <name> --eval)"` for real shell-cd', { default: false })
    .option('--root <dir>', 'A directory to look in for a project that is not on the list yet (overrides STACKS_PROJECTS_ROOT)')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action((name: string | undefined, options: { eval?: boolean, root?: string }) => {
      if (!name) {
        process.stderr.write('Usage: buddy cd <project-name> [--eval] [--root <dir>]\n')
        process.stderr.write('Tip: add `bcd() { eval "$(buddy cd "$1" --eval)"; }` to your shell rc to make this act like a real `cd`.\n')
        process.exit(ExitCode.FatalError)
      }

      // A listed project by name first; failing that, a directory of that
      // name under the given root (or the current directory).
      const root = options.root ?? process.env.STACKS_PROJECTS_ROOT
      const match = findProject(name, root || process.cwd())

      if (match.candidates.length > 0) {
        process.stderr.write(`Ambiguous project name "${name}". Matches:\n`)
        for (const candidate of match.candidates)
          process.stderr.write(`  - ${candidate.name}  →  ${candidate.path}\n`)
        process.exit(ExitCode.FatalError)
      }

      if (!match.project) {
        process.stderr.write(`No Stacks project matched: ${name}\n`)
        process.stderr.write('(Looked on this machine\'s project list; see `buddy projects`. A project joins it the first time buddy runs inside it, and `buddy projects:scan` adds the ones already on disk.)\n')
        process.exit(ExitCode.FatalError)
      }

      if (options.eval)
        process.stdout.write(`cd ${JSON.stringify(match.project.path)}\n`)
      else
        process.stdout.write(`${match.project.path}\n`)

      process.exit(ExitCode.Success)
    })
}
