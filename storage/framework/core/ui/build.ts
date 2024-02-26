import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/config',
    'unocss',
    '@headlessui/vue',
    '@julr/unocss-preset-forms',
    'vue',
    'pinia',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
