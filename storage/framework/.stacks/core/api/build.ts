import { log, runCommand } from '@stacksjs/cli'

const command: string = 'bun build ./src/index.ts --outdir dist --format esm --target bun'
const result = await runCommand(command, {
  cwd: import.meta.dir,
})