import process from 'node:process'
import { log, runCommands } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/enums'
import { projectPath } from '@stacksjs/path'
import { ExitCode } from '@stacksjs/types'

log.info('Ensuring Code Style...')

// TODO: somehow, we currently cannot trigger bunx using $`` syntax
// $.cwd(projectPath())

// await $`${NpmScript.Lint}`
// await $`${NpmScript.LintPackageJson}`

const result = await runCommands([NpmScript.Lint, NpmScript.LintPackageJson], {
  cwd: projectPath(),
})

if (Array.isArray(result)) {
  if (result.map((r) => r.isErr()).includes(true)) process.exit(ExitCode.FatalError)
}

log.success('Linted')
