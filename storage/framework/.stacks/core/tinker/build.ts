import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --external @vue/repl --format esm', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
