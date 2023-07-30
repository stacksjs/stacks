import { log, runCommand } from '@stacksjs/cli'

const result = await runCommand('bun --bun build ./src/index.ts --outdir dist --external vite --external @antfu/install-pkg --external @stacksjs/types --external @stacksjs/logging --external prompts --external @stacksjs/utils --external @stacksjs/validation --external @stacksjs/error-handling --external ora --external kolorist --external cac --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
