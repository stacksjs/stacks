import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommand('bun run dev', {
  cwd: frameworkPath('views/dashboard'),
  // verbose: true,
})
