import process from 'node:process'
import { runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { ExitCode, NpmScript } from '@stacksjs/types'

export default function lintAction() {
  const result = runCommands([
    NpmScript.Lint,
    NpmScript.LintPackageJson,
  ], { cwd: projectPath(), verbose: true })

  if (Array.isArray(result)) {
    if (result.map(r => r.isErr()).includes(true))
      process.exit(ExitCode.FatalError)
  }

  process.exit(ExitCode.Success)
}
