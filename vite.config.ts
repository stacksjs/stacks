import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { alias } from './config/alias'
import { plugins } from './packages/composables/src/stacks'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core', 'unocss/vite'],
  },

  plugins: [
    ...plugins('./unocss.config.ts'),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      imports: ['vue', '@vueuse/core', {
        '@ow3/hello-world-composable': ['count', 'increment', 'isDark', 'toggleDark'],
      }],
      dts: 'packages/core/types/auto-imports.d.ts',
      eslintrc: {
        enabled: true,
      },
    }),

    // https://github.com/antfu/unplugin-vue-components
    Components({
      dirs: ['packages/vue/src/components'],
      extensions: ['vue'],
      dts: 'packages/core/types/components.d.ts',
    }),
  ],
}

export default defineConfig(({ command, mode }) => {
  // console.log('config is', config)
  // eslint-disable-next-line no-console
  console.log('mode is', mode)

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
