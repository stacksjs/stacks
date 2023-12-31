import { log, runCommand } from 'src/cli/src'

const result = await runCommand('bun build ./src/edge/origin-request.ts --outfile ./dist/origin-request.js --outdir ./dist/', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
