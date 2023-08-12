import { runCommand } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external @vinejs/vine --external @stacksjs/utils --external @stacksjs/vite --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  handleError(result.error)
