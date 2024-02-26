import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/cli',
    '@stacksjs/logging',
    'bun',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
