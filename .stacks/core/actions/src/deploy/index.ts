import { path as p } from '@stacksjs/path'
import { runCommand } from '@stacksjs/cli'

// import type { DeployOptions } from '@stacksjs/types'

// await runCommand('bun run deploy', {
//   cwd: cloudPath(),
// })

await runCommand('bun run build', {
  cwd: p.frameworkPath(),
})

await runCommand('bun run build', {
  cwd: p.frameworkPath('docs'),
})

await runCommand('bun actions/src/zip/api.ts', {
  cwd: p.frameworkPath('core'),
})

await runCommand('bunx cdk deploy --profile stacks --require-approval never', {
  cwd: p.cloudPath(),
})
