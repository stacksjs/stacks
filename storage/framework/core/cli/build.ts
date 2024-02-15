import { log, runCommand } from './src'

const result = await runCommand('bun --bun build ./src/index.ts --outdir dist --external vite --external @antfu/install-pkg --external @stacksjs/config --external @stacksjs/types --external @stacksjs/tunnel --external @stacksjs/logging --external prompts --external @stacksjs/utils --external @stacksjs/validation --external @stacksjs/error-handling --external ora --external kolorist --external cac --external @stacksjs/collections --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
