import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/arrays --external @stacksjs/path --external @stacksjs/config --external @stacksjs/strings --external fs-extra --external @stacksjs/error-handling --external @stacksjs/logging --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)

else
  log.success('Build complete')
