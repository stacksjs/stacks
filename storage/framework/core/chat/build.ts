import dts from 'bun-plugin-dts-auto'

await Bun.build({
  entrypoints: ['./src/index.ts'],

  outdir: './dist',
  format: 'esm',
  target: 'bun',

  external: [
    '@novu/stateless',
    '@stacksjs/cli',
    '@stacksjs/error-handling',
    '@novu/discord',
    '@novu/ms-teams',
    '@novu/node',
    '@novu/slack',
  ],

  plugins: [
    dts({
      cwd: import.meta.dir,
    }),
  ],
})
