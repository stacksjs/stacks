import { intro, outro } from '@stacksjs/build'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  root: './src',

  entrypoints: [
    './src/index.ts',
  ],

  outdir: './dist',
  format: 'esm',

  external: [
    '@aws-sdk/client-bedrock-runtime',
    '@aws-sdk/client-bedrock',
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
