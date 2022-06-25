import { resolve } from 'path'
import { alias } from '../config'
import { BuildConfig } from 'unbuild'

export function buildStacks(entries: string[] = ['./src/index'], outDir?: string): BuildConfig {  
  if (!outDir)
    outDir = resolve(__dirname, '../dist')

  return {
    alias,
    entries,
    outDir,
    clean: true,
    declaration: true,
    rollup: {
      emitCJS: true,
      inlineDependencies: true,
    },
    externals: [
      'vite', 'vue', '@vueuse/core',
    ],
  }
}
