import { log, runCommand } from '@stacksjs/cli'
import { path as p } from '@stacksjs/path'

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

await runCommand('bunx cdk deploy --profile stacks --require-approval never', {
  cwd: p.cloudPath(),
})
