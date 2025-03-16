import { dts } from 'bun-plugin-dtsx'
import { intro, outro } from '../build/src'

const { startTime } = await intro({
  dir: import.meta.dir,
})

const result = await Bun.build({
  root: './src',
  outdir: './dist',
  format: 'esm',
  target: 'bun',
  // sourcemap: 'linked',
  minify: false,
  splitting: true,

  entrypoints: [
    './src/build/component-libs.ts',
    './src/build/core.ts',
    './src/build/stacks.ts',
    './src/database/seed.ts',
    './src/deploy/index.ts',
    './src/dev/index.ts',
    './src/dev/components.ts',
    './src/dev/docs.ts',
    './src/generate/index.ts',
    './src/generate/component-meta.ts',
    './src/generate/ide-helpers.ts',
    './src/generate/lib-entries.ts',
    './src/generate/vscode-custom-data.ts',
    './src/helpers/component-meta.ts',
    './src/helpers/lib-entries.ts',
    './src/helpers/package-json.ts',
    './src/helpers/utils.ts',
    './src/helpers/vscode-custom-data.ts',
    './src/lint/index.ts',
    './src/lint/fix.ts',
    './src/test/index.ts',
    './src/test/feature.ts',
    './src/test/ui.ts',
    './src/test/unit.ts',
    './src/upgrade/dependencies.ts',
    './src/upgrade/framework.ts',
    './src/upgrade/index.ts',
    './src/add.ts',
    './src/build.ts',
    './src/bump.ts',
    './src/changelog.ts',
    './src/clean.ts',
    './src/commit.ts',
    './src/copy-types.ts',
    './src/examples.ts',
    './src/fresh.ts',
    './src/index.ts',
    './src/key-generate.ts',
    './src/make.ts',
    './src/prepublish.ts',
    './src/release.ts',
    './src/typecheck.ts',
    './src/types.ts',
    './src/upgrade.ts',
  ],

  external: [
    '@stacksjs/ai',
    '@stacksjs/cli',
    '@stacksjs/config',
    '@stacksjs/enums',
    '@stacksjs/error-handling',
    '@stacksjs/logging',
    '@stacksjs/path',
    '@stacksjs/storage',
    '@stacksjs/utils',
  ],

  plugins: [
    dts({
      root: './src',
      outdir: './dist',
    }),
  ],
})

await outro({
  dir: import.meta.dir,
  startTime,
  result,
})
