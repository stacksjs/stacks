import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  sourcemap: 'linked',

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
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
