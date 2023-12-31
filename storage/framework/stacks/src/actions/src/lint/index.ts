import process from 'node:process'
import { runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'
import { NpmScript } from '@stacksjs/enums'

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
