import process from 'node:process'
import { runCommands } from 'stacks:cli'
import { projectPath } from 'stacks:path'
import { ExitCode } from 'stacks:types'
import { NpmScript } from 'stacks:enums'

export default async function lintAction() {
  const result = await runCommands([
    NpmScript.Lint,
    NpmScript.LintPackageJson,
  ], { cwd: projectPath(), verbose: true })

  if (Array.isArray(result)) {
    if (result.map(r => r.isErr()).includes(true))
      process.exit(ExitCode.FatalError)
  }

  process.exit(ExitCode.Success)
}
