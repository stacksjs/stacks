import { resolve } from 'path'
import type { BuildConfig } from 'unbuild'
import { alias } from '../config'

export default function buildConfig(entries: string[] = ['./src/index'], outDir?: string): BuildConfig {
  if (!outDir)
    outDir = resolve(__dirname, '../dist')

  return {
    alias: alias.default,
    entries,
    outDir,
    clean: true,
    declaration: true,
    rollup: {
      emitCJS: true,
      inlineDependencies: true,
    },
    externals: [
      'stacks',
    ],
  }
}
