import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/config --external @stacksjs/faker --external @stacksjs/path --external @stacksjs/query-builder --external @stacksjs/storage --external @stacksjs/strings --external @stacksjs/utils --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
