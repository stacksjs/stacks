import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/chat...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],

  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@novu/stateless',
    '@stacksjs/cli',
    '@stacksjs/error-handling',
    '@novu/discord',
    '@novu/ms-teams',
    '@novu/node',
    '@novu/slack',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})

log.success(`Built @stacksjs/chat`)
