import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'bun',
  // sourcemap: 'linked',
  minify: true,
  external: [
    '@stacksjs/cli',
    '@stacksjs/cloud',
    '@stacksjs/config',
    '@stacksjs/error-handling',
    '@stacksjs/logging',
    '@stacksjs/path',
    '@stacksjs/utils',
    '@stacksjs/strings',
    '@stacksjs/storage',
    '@stacksjs/env',
    '@stacksjs/cli',
    'aws-cdk-lib', // TODO: a recent AWS issue. We want to potentially remove this once the issue is resolved. Dig deeper into this before removing
  ],
  plugins: [
    dts({
      root: './src',
      outdir: './dist',
    }),
  ],
})

// Building the edge/origin-request separately
const res = await Bun.build({
  entrypoints: ['./src/edge/origin-request.ts'],
  outdir: './dist',
  // Specify any additional options if needed
})

if (!res.success)
  throw new Error('Failed to build edge/origin-request')

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
