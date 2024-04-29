import { alias } from '@stacksjs/alias'
import {
  frameworkPath,
  functionsPath,
  libraryEntryPath,
  projectPath,
} from '@stacksjs/path'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import type { ViteBuildOptions } from '.'

// import { autoImports } from '.'

export const functionsConfig: UserConfig = {
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
    outDir: frameworkPath('functions/dist'),
    emptyOutDir: true,
    sourcemap: true,
    // sourcemap: library.functions?.shouldGenerateSourcemap,
    lib: {
      entry: libraryEntryPath('functions'),
      name: 'test-name',
      // name: library.functions?.name,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es') return 'index.mjs'

        if (format === 'cjs') return 'index.cjs'

        return 'index.?.js'
      },
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve') return functionsConfig

  // command === 'build'
  return functionsConfig
})
