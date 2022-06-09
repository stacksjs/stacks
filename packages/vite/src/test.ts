// import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Unocss from 'unocss/vite'
import Inspect from 'vite-plugin-inspect'
import dts from 'vite-plugin-dts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

export default function Test(userOptions = {}) {
    // eslint-disable-next-line no-console
    console.log('Stacks userOptions', userOptions);

    // name: 'vite-plugin-stacks',

    // resolve: {
    //     dedupe: ['vue'],
    //     alias,
    // },

    return [
        Vue(),

        Unocss({
            configFile: './unocss.config.ts',
            mode: 'vue-scoped', // or 'shadow-dom'
        }),

        Inspect(), // only applies in dev mode & visit localhost:3000/__inspect/ to inspect the modules

        dts({
            tsConfigFilePath: '../../../tsconfig.json',
            insertTypesEntry: true,
            outputDir: './types',
            cleanVueFileName: true,
        }),

        // https://github.com/antfu/unplugin-auto-import
        AutoImport({
            imports: ['vue', '@vueuse/core', {
                '@ow3/hello-world-composable': ['count', 'increment', 'isDark', 'toggleDark'],
            }],
            dts: '../packages/types/auto-imports.d.ts',
            eslintrc: {
                enabled: true,
                filepath: '../../.eslintrc-auto-import.json',
            },
        }),
    ]




    //     // https://github.com/antfu/unplugin-vue-components
    //     Components({
    //         dirs: ['../../vue/src/components'],
    //         extensions: ['vue'],
    //         dts: '../types/components.d.ts',
    //     }),
    // ],

    // // vue components build
    // build: buildVueComponents,
    // }
}
