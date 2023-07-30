import { runCommand } from '@stacksjs/cli'

const command: string = 'bun build ./src/index.ts --outdir dist --external @stacksjs/cli --external @novu/gupshup --external @stacksjs/types --external @stacksjs/error-handling --external @novu/nexmo --external @novu/plivo --external @novu/sms77 --external @novu/sns --external @novu/telnyx --external @novu/termii --external @novu/twilio --format esm'
const result = await runCommand(command, import.meta.dir)

if (result.isErr())
  console.error(result.error)
else
  // eslint-disable-next-line no-console
  console.log('Build complete')
