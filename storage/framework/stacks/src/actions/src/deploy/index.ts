import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'

await runCommand('bun run build', {
  cwd: p.frameworkPath(),
})

if (storage.hasFiles(p.projectPath('docs'))) {
  await runCommand('bun run build', {
    cwd: p.frameworkStoragePath('docs'),
  })
}

if (config.app.docMode !== true) { // when in docs mode, we disregard building views
  await runCommand('bun run build', {
    cwd: p.frameworkStoragePath('views'),
  })
}

// await runCommand('bun run build-layer', {
//   cwd: p.corePath('cloud'),
// })

// await runCommand('bun run build-edge', {
//   cwd: p.corePath('cloud'),
// })

await runCommand('bun zip/api.ts', {
  cwd: p.actionsPath(),
})

await runCommand('bun zip.ts', {
  cwd: p.cloudPath(),
})

log.info('Preparing deployment...')

const profile = process.env.AWS_PROFILE || 'stacks'

// TODO: ensure we check whether cdk bootstrap needs to be run
await runCommand(`bunx cdk deploy --require-approval never --profile="${profile}"`, {
  cwd: p.cloudPath(),
})
