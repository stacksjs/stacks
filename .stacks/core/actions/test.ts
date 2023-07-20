import { log, runCommand } from '@stacksjs/cli'

log.info('Running build...')
const result = await runCommand('bun run build', {
  cwd: import.meta.dir,
})
