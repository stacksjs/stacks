import { runCommand } from '@stacksjs/cli'

await runCommand('bun run build', {
  cwd: import.meta.dir,
})
