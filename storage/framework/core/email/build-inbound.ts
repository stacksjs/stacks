import { log, runCommand } from '@stacksjs/cli'

// eslint-disable-next-line antfu/no-top-level-await
const result = await (runCommand as any)(
  'bun build ./src/server/inbound.ts --outdir dist --external aws-sdk --format esm --target node',
  {
    cwd: import.meta.dir,
  },
)

if ((result as any).isErr())
  (log as any).error((result as any).error)
