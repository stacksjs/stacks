import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',

  external: [
    'bun',
    '@stacksjs/vite',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
