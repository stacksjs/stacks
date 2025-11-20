#!/usr/bin/env bun
// Ultra-fast clapp-based router - uses clapp APIs for all commands
import { cli } from '@stacksjs/clapp'
import { dim, gray } from '@stacksjs/cli'

const args = process.argv.slice(2)
const command = args[0] || ''
const startTime = performance.now()

// Helper to show execution time
function showExecutionTime() {
  const elapsed = performance.now() - startTime
  const timeMs = Math.round(elapsed)

  // Only show for commands that take >100ms (skip instant ones)
  if (timeMs > 100) {
    console.log(dim(gray(`\n⏱  Execution time: ${timeMs}ms`)))
  }
}

// Create lightweight clapp instance
const buddy = cli('buddy')

// Add version
const pkg = require('./package.json')
buddy.version(pkg.version)

// Fast path commands - register with minimal overhead
buddy
  .command('dev', 'Start development server (ultra-fast)')
  .alias('serve')
  .example('buddy dev')
  .example('buddy serve')
  .action(async () => {
    const { serve } = await import('bun-plugin-stx/serve')
    console.log('🚀 Starting STX development server on http://localhost:3456\n')
    await serve({
      patterns: ['resources/views'],
      port: 3456,
    })
  })

buddy
  .command('build', 'Bundle your project for production')
  .example('buddy build')
  .action(async () => {
    const { build } = await import('./storage/framework/core/actions/src/build')
    await build({})
    showExecutionTime()
  })

buddy
  .command('test [filter]', 'Run your test suite')
  .alias('t')
  .example('buddy test')
  .example('buddy test --filter=unit')
  .action(async () => {
    const { runAction } = await import('@stacksjs/actions')
    await runAction('test')
    showExecutionTime()
  })

buddy
  .command('lint', 'Lint and format your code')
  .example('buddy lint')
  .example('buddy lint --fix')
  .action(async () => {
    const { runAction } = await import('@stacksjs/actions')
    await runAction('lint')
    showExecutionTime()
  })

// For all other commands, lazy load the full CLI
const fastCommands = ['version', 'dev', 'serve', 'build', 'test', 't', 'lint', '-v', '--version', '-h', '--help', 'help']
if (command && !fastCommands.includes(command)) {
  // Load full CLI for other commands
  await import('./storage/framework/core/buddy/src/cli')
  showExecutionTime()
} else {
  // Use lightweight clapp for fast commands
  buddy.help()
  await buddy.parse()
}
