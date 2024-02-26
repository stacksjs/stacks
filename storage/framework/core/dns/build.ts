import dts from 'bun-plugin-dts-auto'
import { log } from '@stacksjs/logging'

log.info(`Building @stacksjs/dns...`)

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    'aws-cdk-lib',
    '@stacksjs/enums',
    '@aws-sdk/client-route-53',
    'constructs',
    '@stacksjs/config',
    '@stacksjs/storage',
    '@stacksjs/error-handling',
    '@stacksjs/actions',
    '@stacksjs/strings',
    '@stacksjs/logging',
    '@stacksjs/path',
    '@stacksjs/error-handling',
    '@stacksjs/whois',
    '@aws-sdk/client-route-53-domains',
    '@stacksjs/types',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})

log.success(`Built @stacksjs/dns`)
