import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: ['@stacksjs/config', 'unocss', '@headlessui/vue', '@julr/unocss-preset-forms', 'vue', 'pinia'],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
