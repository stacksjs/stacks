import { resolve } from 'path'
import type { BuildOptions as ViteBuildOptions } from 'vite'
import alias from '../../../config/alias'
import app from '../../../config/library'
import type { BuildConfig as UnbuildConfig } from 'unbuild'
import { defineBuildConfig } from 'unbuild'
import stacksBuildConfig from '../builds/stacks'

export type BuildConfig = UnbuildConfig

function buildVueComponents(entry?: string): ViteBuildOptions {
  if (!entry)
    entry = resolve(__dirname, '../../../components/index.ts')

  return {
    lib: {
      entry,
      name: app.VUE_PACKAGE_NAME,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return `${app.VUE_PACKAGE_NAME}.mjs`

        if (format === 'cjs')
          return `${app.VUE_PACKAGE_NAME}.cjs`

        // if (format === 'iife')
        //     return `${app.VUE_PACKAGE_NAME}.global.js`

        return `${app.VUE_PACKAGE_NAME}.?.js`
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

function buildWebComponents(entry?: string): ViteBuildOptions {
  if (!entry)
    entry = resolve(__dirname, '../../components/index.ts')

  return {
    lib: {
      entry,
      name: app.WEB_COMPONENTS_PACKAGE_NAME,
      formats: ['cjs', 'es'],
      fileName: (format: string) => {
        if (format === 'es')
          return `${app.WEB_COMPONENTS_PACKAGE_NAME}.mjs`

        if (format === 'cjs')
          return `${app.WEB_COMPONENTS_PACKAGE_NAME}.cjs`

        // if (format === 'iife')
        //   return 'hello-world-elements.global.js'

        return `${app.WEB_COMPONENTS_PACKAGE_NAME}.?.js`
      },
      // sourcemap: true,
      // minify: false,;
    },
  }
}

function buildFunctions(entries: string[] = ['./index']): BuildConfig {
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

export {
  defineBuildConfig,
  buildVueComponents,
  buildWebComponents,
  buildFunctions,
  stacksBuildConfig,
}
