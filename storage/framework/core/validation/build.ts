import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@vinejs/vine',
    '@stacksjs/vite',
    '@stacksjs/strings',
    '@stacksjs/types',
    '@dinero.js/currencies',
    'dinero.js',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
