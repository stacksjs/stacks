import { log, runCommand } from 'stacks:cli'

const result = await runCommand('bun build ./src/index.ts --outdir dist --format esm --external stacks:cli --external stacks:config --external stacks:error-handling --external stacks:types --external @maizzle/framework --external @novu/stateless --external @novu/emailjs --external @novu/mailgun --external @novu/mailjet --external @novu/mandrill --external @novu/netcore --external @novu/node --external @novu/nodemailer --external @novu/postmark --external @novu/sendgrid --external @novu/ses --external json5 --target bun', {
  cwd: import.meta.dir,
})

if (result.isErr())
  log.error(result.error)
