import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: [
    './src/index.ts',
  ],

  outdir: './dist',
  format: 'esm',

  external: [
    '@stacksjs/path',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
