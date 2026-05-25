import type { CLI } from '@stacksjs/types'
import { basename } from 'node:path'
import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import { findStacksProjects } from '@stacksjs/utils'

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
 * The underlying scan (`findStacksProjects`) excludes `~/Documents`,
 * `~/Library`, `~/Pictures`, `~/.Trash` by default. Users with projects
 * outside `~/` can point the scan at a specific root via `--root <dir>`
 * or the `STACKS_PROJECTS_ROOT` env var.
 *
 * stacksjs/stacks#527.
 */
export function cd(buddy: CLI): void {
  buddy
    .command('cd [name]', 'Print the absolute path of a Stacks project by name')
    .option('--eval', 'Emit `cd "path"` instead of just the path — pair with `eval "$(buddy cd <name> --eval)"` for real shell-cd', { default: false })
    .option('--root <dir>', 'Search root for the project scan (overrides STACKS_PROJECTS_ROOT and the home-dir default)')
    .option('--verbose', 'Enable verbose output', { default: false })
    .action(async (name: string | undefined, options: { eval?: boolean, root?: string }) => {
      if (!name) {
        process.stderr.write('Usage: buddy cd <project-name> [--eval] [--root <dir>]\n')
        process.stderr.write('Tip: add `bcd() { eval "$(buddy cd "$1" --eval)"; }` to your shell rc to make this act like a real `cd`.\n')
        process.exit(ExitCode.FatalError)
      }

      // Precedence: --root flag → STACKS_PROJECTS_ROOT env → home-dir default
      // (findStacksProjects falls back to os.homedir() when passed undefined).
      const root = options.root ?? process.env.STACKS_PROJECTS_ROOT ?? undefined

      // findStacksProjects walks the root; --quiet suppresses status logs
      // so stdout stays clean (eval-safe).
      const projects = await findStacksProjects(root, { quiet: true })
      const needle = name.toLowerCase()
      const exact = projects.filter(p => basename(p).toLowerCase() === needle)
      const matches = exact.length > 0
        ? exact
        : projects.filter(p => basename(p).toLowerCase().includes(needle))

      if (matches.length === 0) {
        process.stderr.write(`No Stacks project matched: ${name}\n`)
        if (!root)
          process.stderr.write('(Scanned home dir, excluding ~/Documents, ~/Library, ~/Pictures, ~/.Trash. Set STACKS_PROJECTS_ROOT or pass --root <dir> to scan elsewhere.)\n')
        process.exit(ExitCode.FatalError)
      }

      if (matches.length > 1) {
        process.stderr.write(`Ambiguous project name "${name}". Matches:\n`)
        for (const m of matches)
          process.stderr.write(`  - ${basename(m)}  →  ${m}\n`)
        process.exit(ExitCode.FatalError)
      }

      const dest = matches[0]!
      if (options.eval)
        process.stdout.write(`cd ${JSON.stringify(dest)}\n`)
      else
        process.stdout.write(`${dest}\n`)

      process.exit(ExitCode.Success)
    })
}
