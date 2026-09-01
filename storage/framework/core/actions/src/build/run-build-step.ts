import type { CliOptions } from '@stacksjs/types'
import process from 'node:process'
import { runCommand } from '@stacksjs/cli'

/**
 * Run one build subprocess and fail loudly but quietly.
 *
 * A build step's real diagnosis comes from the tool it spawns - a template
 * parse error, a type error, a missing entry point - and that output has
 * already been written to the terminal by the time control returns here. What
 * happened next made it hard to find: `throw result.error` let a
 * `Failed to execute command: bunx --bun @stacksjs/stx build …` error escape
 * the action module uncaught, so Bun printed it with a stack through
 * handleError, exec and runCommand. The last twenty lines of the build were
 * then entirely about the framework's own plumbing, and the parse error that
 * caused it had scrolled away.
 *
 * Worse for `build --views` specifically: `buddy serve` keeps serving whatever
 * the previous successful build produced, so the visible symptom of a failed
 * build is that newly added pages 404 while existing ones keep working. That
 * is a long way from "a partial has a syntax error". stacksjs/stacks#2391.
 *
 * So: exit non-zero with one line that names the command and points at its
 * output, and no stack. A caller that wants the framework-level trace can pass
 * `--verbose`, which is already threaded through to the child.
 */
export async function runBuildStep(command: string | string[], options: CliOptions & { describe: string }): Promise<void> {
  const { describe, ...cliOptions } = options
  const result = await runCommand(command, cliOptions)

  if (!result.isErr)
    return

  // Argv form is accepted because `runCommand` splits a command string on
  // whitespace, which mangles any argument containing one - a path with a
  // space, a quoted flag value. Callers that have such arguments pass an
  // array, and only the message has to put it back together.
  const printable = Array.isArray(command) ? command.join(' ') : command

  console.error(`\n${describe} failed: \`${printable}\` exited non-zero.`)
  console.error('The error it printed above is the cause - this step only relays its exit status.\n')
  process.exit(1)
}
