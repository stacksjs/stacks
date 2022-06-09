import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import Stacks from '@ow3/vite-plugin-stacks'

// https://vitejs.dev/config/
const config: UserConfig = {
  plugins: [
    Stacks(),
    // Stacks({
    //   customElement: true,
    // }),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
