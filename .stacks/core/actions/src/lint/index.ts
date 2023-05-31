import { ExitCode, runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { NpmScript } from '@stacksjs/types'

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
