import type { Subprocess } from '@stacksjs/types'
import process from 'node:process'
import { log, runCommand } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

log.info('Building the framework...')
await runCommand('bun run build', {
  cwd: p.frameworkPath(),
})
log.success('Framework built')

if (storage.hasFiles(p.projectPath('docs'))) {
  log.info('Building the documentation...')
  await runCommand('bun run build', {
    cwd: p.frameworkPath('docs'),
  })
  log.success('Documentation built')
}

// when in docMode, we can disregard building views
if (config.app.docMode !== true) {
  log.info('Building the views...')
  await runCommand('bun run build', {
    cwd: p.frameworkPath('views/web'),
  })
  log.success('Views built')
}

// await runCommand('bun run build-edge', {
//   cwd: p.corePath('cloud'),
// })

log.info('Building the server...')
await runCommand('bun build.ts', {
  cwd: p.frameworkPath('server'),
})
log.success('Server built')

await runCommand('bun zip.ts', {
  cwd: p.corePath('cloud'),
})

log.info('Deploying using ts-cloud...')

// Use ts-cloud deployment instead of CDK
try {
  const { deployStack, deployFrontend } = await import('../../deploy')

  const environment = process.env.CLOUD_ENV || process.env.NODE_ENV || 'production'
  const region = process.env.AWS_REGION || 'us-east-1'

  // Step 1: Deploy infrastructure stack
  log.info('Deploying infrastructure stack...')
  await deployStack({
    environment,
    region,
    waitForCompletion: true,
  })
  log.success('Infrastructure stack deployed')

  // Step 2: Deploy frontend (if views were built)
  if (config.app.docMode !== true) {
    log.info('Deploying frontend...')
    await deployFrontend({
      environment,
      region,
      buildDir: p.frameworkPath('views/web/dist'),
    })
    log.success('Frontend deployed')
  }

  log.success('Deployment completed successfully!')
} catch (error) {
  log.error('Deployment failed:', error)
  process.exit(ExitCode.FatalError)
}

// Legacy CDK deployment (commented out for reference)
// const profile = process.env.AWS_PROFILE ?? 'stacks'
// const result = await runCommand(`bunx --bun cdk deploy --require-approval never --profile="${profile}"`, {
//   cwd: p.frameworkCloudPath(),
// })
// if (result.isErr()) {
//   log.error(result.error)
//   process.exit(ExitCode.FatalError)
// }
// const t = result.value as Subprocess
// await t.exited
