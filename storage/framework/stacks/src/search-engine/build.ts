import { log, runCommand } from 'src/cli/src'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/config --external @stacksjs/ui --external @stacksjs/utils --external @stacksjs/logging --external @stacksjs/validation --external meilisearch --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
