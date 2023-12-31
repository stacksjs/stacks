import { log, runCommand } from '@stacksjs/cli'

const command: string = 'bun build ./src/index.ts --outdir dist --external @stacksjs/cli --external @stacksjs/config --external @novu/gupshup --external @stacksjs/types --external @stacksjs/error-handling --external @novu/nexmo --external @novu/plivo --external @novu/sms77 --external @novu/sns --external @novu/telnyx --external @novu/termii --external @novu/twilio --format esm'
const result = await runCommand(command, {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
