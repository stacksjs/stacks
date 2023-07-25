import { runCommand } from './src/run'

const result = await runCommand('bun --bun build ./src/index.ts --outdir dist --external vite --external @antfu/install-pkg --external @stacksjs/types --external @stacksjs/logging --external prompts --external @stacksjs/utils --external @stacksjs/validation --external @stacksjs/error-handling --external ora --external kolorist --external unocss --external @unocss/config --external unconfig --external jiti --target node', {
  cwd: import.meta.dir,
})

if (result.isErr())
  console.error(result.error)

else
  console.write('Build complete')
