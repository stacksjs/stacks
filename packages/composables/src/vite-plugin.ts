import { ref } from 'vue'
import { resolve } from 'pathe'
import type { BuildOptions } from 'vite'
import { VUE_PACKAGE_NAME, WEB_COMPONENTS_PACKAGE_NAME } from '../../../config/constants'

function buildVueComponents(entry: string): BuildOptions {
  return {
    lib: {
      entry: resolve(__dirname, entry),
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
      external: ['vue'],
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

function buildWebComponents(entry: string): BuildOptions {
  return {
    lib: {
      entry: resolve(__dirname, entry),
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

export {
  buildVueComponents,
  buildWebComponents,
}
