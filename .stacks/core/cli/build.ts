import { runCommand } from '@stacksjs/cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @stacksjs/error-handling --external @stacksjs/logging --external @stacksjs/path --external @stacksjs/types --external @stacksjs/utils --external @antfu/install-pkg --external bun --external vite --target bun', {
  cwd: import.meta.dir,
})

// if (result.isErr())
//   log.error(result.error)

// else
//   log.success('Build complete')
