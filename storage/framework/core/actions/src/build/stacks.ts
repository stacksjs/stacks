import { projectPath } from '@stacksjs/path'
import { runBuildStep } from './run-build-step'

// Build the CLI first, then build all core packages.
//
// `runCommands` was used here and does surface a failure - but by rethrowing
// the error `handleError` already printed, which reaches the top of the module
// uncaught and buries the child's own output under a Bun stack through
// handleError, exec, runCommand and runCommands. Same reasoning as
// stacksjs/stacks#2391: the build tool has already said what went wrong, so
// this only has to relay its exit status.
await runBuildStep('bun storage/framework/core/actions/src/build/cli.ts', {
  verbose: true,
  cwd: projectPath(),
  describe: 'The CLI build',
})

await runBuildStep('bun storage/framework/core/actions/src/build/core.ts', {
  verbose: true,
  cwd: projectPath(),
  describe: 'The core packages build',
})
