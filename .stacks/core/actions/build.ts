import { Console, kolorist as c } from '@stacksjs/cli'

// this script is significantly slower (50%, or a few ms 😅) than using the bun cli directly
// keeping it included as a future reference point

// import { ExitCode } from '@stacksjs/types'

Console.info(`Building ${c.italic('@stacksjs/actions...')}`)
//
// Console.log(`Building ${c.italic('@stacksjs/actions...')}`)
// Console.log('')

// const result = await Bun.build({
//   target: 'bun',
//   entrypoints: [
//     './src/index.ts',
//     // './src/build/component-libs.ts',
//     // './src/build/core.ts',
//     // './src/build/stacks.ts',
//     // './src/dev/index.ts',
//     // './src/dev/components.ts',
//     // './src/dev/docs.ts',
//     // './src/generate/index.ts',
//     // './src/generate/component-meta.ts',
//     // './src/generate/ide-helpers.ts',
//     // './src/generate/lib-entries.ts',
//     // './src/generate/vscode-custom-data.ts',
//     // './src/generate/vue-compat.ts',
//     // './src/helpers/index.ts',
//     // './src/helpers/component-meta.ts',
//     // './src/helpers/lib-entries.ts',
//     // './src/helpers/package-json.ts',
//     // './src/helpers/utils.ts',
//     // './src/helpers/vscode-custom-data.ts',
//     // './src/helpers/vue-compat.ts',
//     // './src/lint/index.ts',
//     // './src/lint/fix.ts',
//     // './src/test/coverage.ts',
//     // './src/test/ui.ts',
//     // './src/test/unit.ts',
//     // './src/upgrade/dependencies.ts',
//     // './src/upgrade/framework.ts',
//     // './src/upgrade/index.ts',
//     // './src/index.ts',
//     // './src/add.ts',
//     // './src/build.ts',
//     // './src/bump.ts',
//     // './src/changelog.ts',
//     // './src/clean.ts',
//     // './src/commit.ts',
//     // './src/copy-types.ts',
//     // './src/examples.ts',
//     // './src/fresh.ts',
//     // './src/key-generate.ts',
//     // './src/make.ts',
//     // './src/migrate.ts',
//     // './src/preinstall.ts',
//     // './src/prepublish.ts',
//     // './src/release.ts',
//     // './src/seed.ts',
//     // './src/test.ts',
//     // './src/tinker.ts',
//     // './src/typecheck.ts',
//     // './src/types.ts',
//     // './src/upgrade.ts',
//   ],
//   external: [
//     '@stacksjs/path',
//     '@stacksjs/cli',
//     '@stacksjs/types',
//     '@stacksjs/logging',
//     '@stacksjs/storage',
//     '@stacksjs/utils',
//     '@stacksjs/strings',
//     '@stacksjs/config',
//     '@stacksjs/error-handling',
//     '@stacksjs/security',
//     'markdown-it',
//     'vue-component-meta',
//   ],
//   outdir: './dist',
//   sourcemap: 'external',
//   format: 'esm',
// })

// if (!result.success) {
//   Console.error("Build failed");
//
//   for (const message of result.logs) {
//     Console.error(message);
//   }
//
//   process.exit(ExitCode.FatalError)
// }
// const end = Date.now()
//
// const duration = (start: number, end: number) => {
//   const ms = end - start
//   if (ms < 5000) return `${ms}ms`
//   return `${(ms / 1000).toFixed(2)}s`
// }
//
// // a function to log the size of a file
// const readableSize = (bytes: number) => {
//   if (bytes < 1000) return `${bytes} B`
//   if (bytes < 1000000) return `${(bytes / 1000).toFixed(2)} KB`
//   if (bytes < 1000000000) return `${(bytes / 1000000).toFixed(2)} MB`
//   return `${(bytes / 1000000000).toFixed(2)} GB`
// }
//
// const readablePath = (path: string) => {
//   return path.replace(process.cwd(), '.')
// }
//
// // loop over BuildArtifacts and log them including the size of the file
// for (const artifact of result.outputs) {
//   // + @workspace:.stacks/core/actions
//   // Console.log(`${c.green("+")} ${c.bold(readableSize(artifact.size))} (${c.dim(artifact.kind)})`)
//   Console.log(`${c.green("+")} ${c.bold(`@stacksjs/${readablePath(artifact.path)}`)} (${c.dim(artifact.kind)}) ${c.bold(readableSize(artifact.size))}`)
// }
//
// Console.log('')
// Console.success(`@stacksjs/actions build succeeded in ${duration(start, end)}`)
