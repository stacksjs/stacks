import Inspect from 'vite-plugin-inspect'
import dts from 'vite-plugin-dts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import Unocss from 'unocss/vite'

export default function Stacks() {
    return {
        name: 'stacks-plugin',

        plugins: [
            Inspect(), // only applies in dev mode & visit localhost:3000/__inspect/ to inspect the modules

            dts({
                tsConfigFilePath: '../../tsconfig.json',
                insertTypesEntry: true,
                outputDir: './types',
                cleanVueFileName: true,
            }),

            Unocss({
                mode: 'vue-scoped',
                configFile: '../unocss.config.ts',
            }),

            // https://github.com/antfu/unplugin-auto-import
            AutoImport({
                imports: ['vue', '@vueuse/core', {
                    '@ow3/hello-world-composable': ['count', 'increment', 'isDark', 'toggleDark'],
                }],
                dts: '../types/auto-imports.d.ts',
                eslintrc: {
                    enabled: true,
                    filepath: '../.eslintrc-auto-import.json',
                },
            }),

            // https://github.com/antfu/unplugin-vue-components
            Components({
                dirs: ['src/components'],
                extensions: ['vue'],
                dts: '../types/components.d.ts',
            }),
        ],

        // transform(src, id) {
        //     if (fileRegex.test(id)) {
        //         return {
        //             code: compileFileToJS(src),
        //             map: null // provide source map if available
        //         }
        //     }
        // }
    }
}
