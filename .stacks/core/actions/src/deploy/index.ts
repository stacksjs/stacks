import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'
import { originRequestFunctionCodeHash } from '@stacksjs/utils'

await runCommand('bun run build', {
  cwd: p.frameworkPath(),
})

await runCommand('bun run build', {
  cwd: p.frameworkPath('docs'),
})

await runCommand('bun run build-layer', {
  cwd: p.corePath('cloud'),
})

await runCommand('bun run build-edge', {
  cwd: p.corePath('cloud'),
})

await runCommand('bun actions/src/zip/api.ts', {
  cwd: p.frameworkPath('core'),
})

log.info('')
log.info('Preparing deployment...')

// Calculate the hash of the Lambda function's source code
// to future self: there is a chance that in the future the source will be in more places than just the edge folder
log.info(`Lambda function code hash: ${originRequestFunctionCodeHash}`)

await runCommand(`bunx cdk deploy --require-approval never --context originRequestFunctionCodeHash=${originRequestFunctionCodeHash}`, {
  cwd: p.cloudPath(),
})
