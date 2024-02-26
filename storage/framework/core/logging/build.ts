import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@stacksjs/config',
    '@stacksjs/types',
    '@stacksjs/cli',
    '@stacksjs/path',
    '@stacksjs/error-handling',
    'consola',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
