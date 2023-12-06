import { runCommand } from '@stacksjs/cli'
import { frameworkStoragePath } from '@stacksjs/path'

await runCommand('bun run dev', {
  cwd: frameworkStoragePath('docs'),
  // verbose: true,
})
