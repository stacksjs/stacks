import { runCommand } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'

const result = runCommand('bun build ./src/index.ts --outdir dist --format esm --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  handleError(result.error)
