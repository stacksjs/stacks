import { ExitCode, runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/types'

export default async function lintAction() {
  const result = await runCommands([
    NpmScript.Lint,
    NpmScript.LintPackageJson,
  ], { cwd: projectPath(), verbose: true })

  if (result.isErr())
    process.exit(ExitCode.FatalError)

  process.exit(ExitCode.Success)
}
