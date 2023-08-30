import { runCommand } from '@stacksjs/cli'
import { handleError } from '@stacksjs/error-handling'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external change-case --external title-case --external validator --external pluralize --external slugify', {
  cwd: import.meta.dir,
})

if (result.isErr())
  handleError(result.error)
