import { log, runCommand } from './src'

const result = await runCommand('bun --bun build ./src/index.ts --outdir dist --external vite --external @antfu/install-pkg --external stacks:config --external stacks:types --external stacks:tunnel --external stacks:logging --external prompts --external stacks:utils --external stacks:validation --external stacks:error-handling --external ora --external kolorist --external cac --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
