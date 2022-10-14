import type { BuildOptions as ViteBuildOptions } from 'vite'
import { defineConfig } from 'vite'
import type { ViteConfig } from '../../types'
import { functionLibrary } from '../../../config/library'
import { autoImports } from '..'
import alias from '../alias'
import { cliPath, projectPath } from '../../utils/src'

const config: ViteConfig = {
  root: cliPath(),
  envDir: projectPath(),
  envPrefix: 'APP_',

  resolve: {
    alias,
  },

  plugins: [
    autoImports(),
  ],

  build: cliBuildOptions(),
}

export function cliBuildOptions(): ViteBuildOptions {
  return {
    outDir: cliPath('dist'),
    emptyOutDir: true,
    sourcemap: functionLibrary.shouldGenerateSourcemap,
    rollupOptions: {
      external: ['chokidar', 'url', 'fs', 'module', 'path', 'util', 'fs/promises', 'node:path', 'node:url', 'node:module', 'node:perf_hooks', 'node:util', 'node:dns', 'node:crypto', 'node:zlib', 'node:fs', 'node:buffer', 'node:https', 'node:http', 'node:child_process', 'crypto', 'node:worker_threads'],
    },
    lib: {
      entry: cliPath('src/index.ts'),
      name: 'stacks-cli',
      formats: ['es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        return 'index.?.js'
      },
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
