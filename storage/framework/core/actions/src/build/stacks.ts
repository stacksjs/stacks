import { runCommands } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

// Build the CLI first, then build all core packages
await runCommands(
  [
    'bun storage/framework/core/actions/src/build/cli.ts',
  ],
  { verbose: true, cwd: projectPath() },
)

await runCommands(
  [
    'bun storage/framework/core/actions/src/build/core.ts',
  ],
  { verbose: true, cwd: projectPath() },
)
