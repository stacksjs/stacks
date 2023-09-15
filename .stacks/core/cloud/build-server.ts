import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/drivers/aws/runtime/server.ts --outdir src/drivers/aws/runtime --format esm --minify --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
