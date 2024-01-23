import { runCommand } from '@stacksjs/cli'
import { frameworkPath } from '@stacksjs/path'

await runCommand('bun run dev', {
  cwd: frameworkPath('system-tray'),
})
