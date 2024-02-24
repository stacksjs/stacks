import dts from 'bun-plugin-dts-auto'
import { path as p } from '@stacksjs/path'
import { dim, log } from '@stacksjs/cli'

log.info(`Building @stacksjs/actions...`)

const startTime = Date.now()

await Bun.build({
  entrypoints: [
    './src/index.ts',
    './src/build/component-libs.ts',
    './src/build/core.ts',
    './src/build/stacks.ts',
    './src/dev/index.ts',
    './src/dev/components.ts',
    './src/dev/docs.ts',
    './src/generate/index.ts',
    './src/generate/component-meta.ts',
    './src/generate/ide-helpers.ts',
    './src/generate/lib-entries.ts',
    './src/generate/vscode-custom-data.ts',
    './src/helpers/index.ts',
    './src/helpers/component-meta.ts',
    './src/helpers/lib-entries.ts',
    './src/helpers/package-json.ts',
    './src/helpers/utils.ts',
    './src/helpers/vscode-custom-data.ts',
    './src/lint/index.ts',
    './src/lint/fix.ts',
    './src/test/coverage.ts',
    './src/test/feature.ts',
    './src/test/ui.ts',
    './src/test/unit.ts',
    './src/upgrade/dependencies.ts',
    './src/upgrade/framework.ts',
    './src/upgrade/index.ts',
    './src/index.ts',
    './src/add.ts',
    './src/build.ts',
    './src/bump.ts',
    './src/changelog.ts',
    './src/clean.ts',
    './src/commit.ts',
    './src/copy-types.ts',
    './src/deploy/index.ts',
    './src/examples.ts',
    './src/fresh.ts',
    './src/key-generate.ts',
    './src/make.ts',
    './src/prepublish.ts',
    './src/release.ts',
    './src/database/seed.ts',
    './src/test.ts',
    './src/tinker.ts',
    './src/typecheck.ts',
    './src/types.ts',
    './src/upgrade.ts',
  ],

  outdir: './dist',

  external: [
    '@stacksjs/path',
    '@stacksjs/cli',
    '@stacksjs/types',
    '@stacksjs/logging',
    '@stacksjs/enums',
    '@stacksjs/storage',
    '@stacksjs/utils',
    '@stacksjs/strings',
    '@stacksjs/config',
    '@stacksjs/error-handling',
    '@stacksjs/env',
    '@stacksjs/security',
    '@stacksjs/database',
    'markdown-it',
    'vue-component-meta',
  ],

  plugins: [
    dts({
      outDir: `${import.meta.dir}/dist/types`,
      // cwd: import.meta.dirname,
    }),
  ],

  target: 'bun',
})

const endTime = Date.now()
const timeTaken = endTime - startTime

log.success(`${dim(`[${timeTaken}ms]`)} Built @stacksjs/actions`)
