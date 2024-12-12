import { log } from '@stacksjs/cli'

log.info('Checking Code Style...')

// TODO: somehow, we currently cannot trigger bunx --bun using $`` syntax
// $.cwd(projectPath())

// await $`${NpmScript.Lint}`
// await $`${NpmScript.LintPackageJson}`

// const result = await runCommands([NpmScript.Lint, NpmScript.LintPackageJson], {
//   cwd: projectPath(),
// })

// if (Array.isArray(result)) {
//   if (result.map((r) => r.isErr()).includes(true)) process.exit(ExitCode.FatalError)
// }

log.success('Linted')
