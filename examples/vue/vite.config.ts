import type { UserConfig } from 'vite'
import { Stacks, alias, defineBuildConfig } from '@ow3/stacks'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve: {
    alias,
  },

  optimizeDeps: {
    exclude: ['vue', '@vueuse/core', 'unocss/vite'],
  },

  plugins: [
    Stacks(),
  ],
}

export default defineBuildConfig(({ command, mode }) => {
  // eslint-disable-next-line no-console
  console.log('mode is', mode)

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
