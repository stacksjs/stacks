import { runCommand } from '@stacksjs/cli'

const command: string = 'bun build ./src/index.ts --outdir dist --format esm'
const result = await runCommand(command, import.meta.dir)

if (result.isErr())
  console.error(result.error)
else
  // eslint-disable-next-line no-console
  console.log('Build complete')
