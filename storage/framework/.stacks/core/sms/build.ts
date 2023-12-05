import { log, runCommand } from 'stacks:cli'

const command: string = 'bun build ./src/index.ts --outdir dist --external stacks:cli --external stacks:config --external @novu/gupshup --external stacks:types --external stacks:error-handling --external @novu/nexmo --external @novu/plivo --external @novu/sms77 --external @novu/sns --external @novu/telnyx --external @novu/termii --external @novu/twilio --format esm'
const result = await runCommand(command, {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
