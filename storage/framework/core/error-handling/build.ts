import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'node',

  external: [
    '@stacksjs/cli',
    '@stacksjs/path',
    '@stacksjs/storage',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
