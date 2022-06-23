import type { UserConfig } from '../../'
import { Stacks, defineBuildConfig, buildVueComponents as vueComponents } from '../..'
import { alias } from '../../../config'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    dedupe: ['vue'],
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core', 'unocss/vite'],
  },

  plugins: [
    Stacks(),
  ],

  build: vueComponents(),
}

export default defineBuildConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
