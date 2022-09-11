import { resolve } from 'node:path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import alias from '../core/alias'
import { defineConfig } from '../core'
import type { ViteConfig } from '../core'

const config: ViteConfig = {
  resolve: {
    alias,
  },

  optimizeDeps: {
    exclude: ['node:path', 'path', 'node:url', 'node:module', 'fs', 'node:perf_hooks', 'node:util', 'node:dns', 'node:crypto', 'node:zlib', 'module', 'node:fs', 'node:buffer', 'util', 'url', 'node:https', 'node:http', 'node:child_process', 'fs/promises', 'crypto', 'chokidar', '@rollup/pluginutils'],
  },

  build: stacksBuildOptions(),
}

export function stacksBuildOptions(): ViteBuildOptions {
  return {
    outDir: resolve(__dirname, '../../stacks/dist'),

    lib: {
      entry: resolve(__dirname, '../index.ts'),
      name: 'stacks',
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return 'index.mjs'

        if (format === 'cjs')
          return 'index.cjs'

        return 'index.?.js'
      },
    },

    rollupOptions: {
      external: ['node:path', 'path', 'node:url', 'node:module', 'fs', 'node:perf_hooks', 'node:util', 'node:dns', 'node:crypto', 'node:zlib', 'module', 'node:fs', 'node:buffer', 'util', 'url', 'node:https', 'node:http', 'node:child_process', 'fs/promises', 'crypto', 'chokidar', '@rollup/pluginutils'],
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
