import process from 'node:process'
import { runCommands } from 'src/cli/src'
import { projectPath } from 'src/path/src'
import { ExitCode } from 'src/types/src'
import { NpmScript } from 'src/enums/src'

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
