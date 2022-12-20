import { intro, outro, runCommand } from '@stacksjs/cli'
import { ExitCode, NpmScript } from '@stacksjs/types'

const perf = intro('buddy lint')
const result = await runCommand(NpmScript.Lint, { cwd: frameworkPath(), debug: true })

if (result.isErr()) {
  outro('While running `buddy lint`, there was an issue', { startTime: perf, useSeconds: true, isError: true })
  process.exit(ExitCode.FatalError)
}

outro('Linted', { startTime: perf, useSeconds: true })
