import { resolve } from 'path'
import type { BuildOptions } from 'vite'
import { alias } from '../config/alias'
import { VUE_PACKAGE_NAME } from '../config/env'

function buildVueComponents(entry?: string): BuildOptions {
  if (!entry)
    entry = resolve(__dirname, '../packages/components/index.ts')

  // eslint-disable-next-line no-console
  console.log('buildVueComponents with entry of:', entry)

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

// function buildWebComponents(entry: string): BuildOptions {
//   return {
//     lib: {
//       entry: resolve(__dirname, entry),
//       name: WEB_COMPONENTS_PACKAGE_NAME,
//       formats: ['cjs', 'es'],
//       fileName: (format: string) => {
//         if (format === 'es')
//           return `${WEB_COMPONENTS_PACKAGE_NAME}.mjs`

//         if (format === 'cjs')
//           return `${WEB_COMPONENTS_PACKAGE_NAME}.cjs`

//         // if (format === 'iife')
//         //   return 'hello-world-elements.global.js'

//         return `${WEB_COMPONENTS_PACKAGE_NAME}.?.js`
//       },
//       // sourcemap: true,
//       // minify: false,;
//     },
//   }
// }

function buildComposables(entries: string[] = ['./index']) {
  return {
    alias,
    entries,
    clean: true,
    declaration: true,
    rollup: {
      emitCJS: true,
    },
    externals: [
      'vue', '@vueuse/core',
    ],
  }
}

export {
  buildVueComponents,
  // buildWebComponents,
  buildComposables,
}
