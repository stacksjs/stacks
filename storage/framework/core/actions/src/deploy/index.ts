import type { Subprocess } from '@stacksjs/types'
import process from 'node:process'
import { log, runCommand, spinner } from '@stacksjs/cli'
import { config } from '@stacksjs/config'
import { path as p } from '@stacksjs/path'
import { storage } from '@stacksjs/storage'
import { ExitCode } from '@stacksjs/types'

// Check if verbose mode is enabled via CLI args
const isVerbose = process.argv.includes('--verbose') || process.argv.includes('-v')

// Build framework with spinner (quiet unless verbose)
const buildSpinner = spinner('Building framework...')
buildSpinner.start()
await runCommand('bun run build', {
  cwd: p.frameworkPath(),
  quiet: !isVerbose,
})
buildSpinner.succeed('Framework built')

// Skip docs build for now - demo components have missing dependencies
// TODO: Fix demo components to use actual installed packages
// if (storage.hasFiles(p.projectPath('docs'))) {
//   const docsSpinner = spinner('Building documentation...')
//   docsSpinner.start()
//   await runCommand('bun run build', {
//     cwd: p.frameworkPath('docs'),
//     quiet: !isVerbose,
//   })
//   docsSpinner.succeed('Documentation built')
// }
if (isVerbose) log.debug('Skipping documentation build (demo components need updates)')

// Skip views build for now - vite-config is not set up
// TODO: Set up vite-config for views build
// if (config.app.docMode !== true) {
//   const viewsSpinner = spinner('Building views...')
//   viewsSpinner.start()
//   await runCommand('bun run build', {
//     cwd: p.frameworkPath('views/web'),
//     quiet: !isVerbose,
//   })
//   viewsSpinner.succeed('Views built')
// }
if (isVerbose) log.debug('Skipping views build (vite-config not configured)')

// await runCommand('bun run build-edge', {
//   cwd: p.corePath('cloud'),
// })

// Build server
const serverSpinner = spinner('Building server...')
serverSpinner.start()
await runCommand('bun build.ts', {
  cwd: p.frameworkPath('server'),
  quiet: !isVerbose,
})
serverSpinner.succeed('Server built')

// Package for deployment
const packageSpinner = spinner('Packaging for deployment...')
packageSpinner.start()
await runCommand('bun zip.ts', {
  cwd: p.corePath('cloud'),
  quiet: !isVerbose,
})
packageSpinner.succeed('Package ready')

// Load AWS credentials from .env.production if not already set
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  const { existsSync, readFileSync } = await import('node:fs')
  const prodEnvPath = p.projectPath('.env.production')

  if (existsSync(prodEnvPath)) {
    const content = readFileSync(prodEnvPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=').trim()
      if (key === 'AWS_ACCESS_KEY_ID' && value) process.env.AWS_ACCESS_KEY_ID = value
      else if (key === 'AWS_SECRET_ACCESS_KEY' && value) process.env.AWS_SECRET_ACCESS_KEY = value
      else if (key === 'AWS_REGION' && value && !process.env.AWS_REGION) process.env.AWS_REGION = value
    }
    if (isVerbose) log.debug('Loaded AWS credentials from .env.production')
  }
}

// Use ts-cloud deployment instead of CDK
try {
  const { deployStack, deployFrontend } = await import('../../deploy')

  const environment = process.env.CLOUD_ENV || process.env.NODE_ENV || 'production'
  const region = process.env.AWS_REGION || 'us-east-1'

  // Step 1: Deploy infrastructure stack
  const deploySpinner = spinner('Deploying infrastructure...')
  deploySpinner.start()
  await deployStack({
    environment,
    region,
    waitForCompletion: true,
    verbose: isVerbose,
  })
  deploySpinner.succeed('Infrastructure deployed')

  // Skip frontend deployment for now - views build is disabled
  // TODO: Enable frontend deployment when vite-config is set up
  // if (config.app.docMode !== true) {
  //   const frontendSpinner = spinner('Deploying frontend...')
  //   frontendSpinner.start()
  //   await deployFrontend({
  //     environment,
  //     region,
  //     buildDir: p.frameworkPath('views/web/dist'),
  //   })
  //   frontendSpinner.succeed('Frontend deployed')
  // }
  if (isVerbose) log.debug('Skipping frontend deployment (views build is disabled)')

  console.log('')
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
