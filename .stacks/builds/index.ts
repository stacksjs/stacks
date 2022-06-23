import { resolve } from 'path'
import type { BuildOptions } from 'vite'
import { alias } from '../../config'
import { VUE_PACKAGE_NAME, WEB_COMPONENTS_PACKAGE_NAME } from '../../config'
import { BuildConfig } from 'unbuild'

function buildVueComponents(entry?: string): BuildOptions {
  if (!entry)
    entry = resolve(__dirname, '../../components/index.ts')

  return {
    lib: {
      entry,
      name: VUE_PACKAGE_NAME,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return `${VUE_PACKAGE_NAME}.mjs`

        if (format === 'cjs')
          return `${VUE_PACKAGE_NAME}.cjs`

        // if (format === 'iife')
        //     return `${VUE_PACKAGE_NAME}.global.js`

        return `${VUE_PACKAGE_NAME}.?.js`
      },
    },
    rollupOptions: {
      external: ['vue', '@vueuse/core'],
      output: {
        // exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },

    // sourcemap: true,
    // minify: false,
  }
}

function buildWebComponents(entry?: string): BuildOptions {
  if (!entry)
    entry = resolve(__dirname, '../../components/index.ts')

  return {
    lib: {
      entry,
      name: WEB_COMPONENTS_PACKAGE_NAME,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return `${WEB_COMPONENTS_PACKAGE_NAME}.mjs`

        if (format === 'cjs')
          return `${WEB_COMPONENTS_PACKAGE_NAME}.cjs`

        // if (format === 'iife')
        //   return 'hello-world-elements.global.js'

        return `${WEB_COMPONENTS_PACKAGE_NAME}.?.js`
      },
      // sourcemap: true,
      // minify: false,;
    },
  }
}

function buildComposables(entries: string[] = ['./index']): BuildConfig {
  return {
    alias,
    entries,
    outDir: resolve(__dirname, '../../composables/dist'),
    clean: true,
    declaration: true,
    rollup: {
      emitCJS: true,
      inlineDependencies: true,
    },
    externals: [
      'vue', '@vueuse/core',
    ],
  }
}

function buildStacks(entries: string[] = ['./index'], outDir?: string): BuildConfig {
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
      'vite', 'unbuild', 'vue', '@vueuse/core',
    ],
  }
}

export {
  buildVueComponents,
  buildWebComponents,
  buildComposables,
  buildStacks,
}
