import { runCommand } from 'src/cli/src'
import { handleError } from 'src/error-handling/src'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external change-case --external title-case --external validator --external pluralize --external slugify --external detect-indent --external detect-newline', {
  cwd: import.meta.dir,
})

if (result.isErr())
  handleError(result.error)
