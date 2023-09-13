import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts ./src/cli.ts --outdir dist --format esm --target bun --external @stacksjs/actions --external @stacksjs/error-handling --external @stacksjs/cli --external @stacksjs/logging --external @stacksjs/utils --external @stacksjs/validation --external @stacksjs/path --external @stacksjs/storage --splitting --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
