import { runCommand } from './src'

const result = await runCommand('bun --bun build ./src/index.ts --outdir ./cli/dist --external vite --external @antfu/install-pkg --external bun --external @stacksjs/types --external @stacksjs/logging --external prompts --external @stacksjs/utils --external @stacksjs/validation --external @stacksjs/error-handling --external ora --external kolorist --target bun', {
  cwd: import.meta.dir,
})

// if (result.isErr())
//   console.error(result.error)

// else
//   console.write('Build complete!')
