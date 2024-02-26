import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/email...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  external: [
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/error-handling',
    '@stacksjs/types',
    '@maizzle/framework',
    '@novu/stateless',
    '@novu/emailjs',
    '@novu/mailgun',
    '@novu/mailjet',
    '@novu/mandrill',
    '@novu/netcore',
    '@novu/node',
    '@novu/nodemailer',
    '@novu/postmark',
    '@novu/sendgrid',
    '@novu/ses',
    'json5',
  ],
  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})

log.success(`Built @stacksjs/email`)
