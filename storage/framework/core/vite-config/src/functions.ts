import type { UserConfig as ViteConfig } from 'vite'
import type { ViteBuildOptions } from '.'
import { alias } from '@stacksjs/alias'
import { frameworkPath, functionsPath, libraryEntryPath, projectPath } from '@stacksjs/path'

export const functionsConfig: ViteConfig = {
  root: functionsPath(),
  envDir: projectPath(),
  envPrefix: '',

  resolve: {
    alias,
  },

  // plugins: [
  //   autoImports(),
  // ],

  build: functionsBuildOptions(),
}

export function functionsBuildOptions(): ViteBuildOptions {
  return {
    outDir: frameworkPath('defaults/functions/dist'),
    emptyOutDir: true,
    sourcemap: true,
    // sourcemap: library.functions?.shouldGenerateSourcemap,
    lib: {
      entry: libraryEntryPath('functions'),
      name: 'test-name',
      // name: library.functions?.name,
      formats: ['es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        return 'index.?.js'
      },
    },
  }
}

export default functionsConfig

// export default defineConfig(({ command }) => {
//   if (command === 'serve') return functionsConfig

//   // command === 'build'
//   return functionsConfig
// })
