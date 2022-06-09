import { defineConfig } from 'vite'
import { Stacks } from '@ow3/vite-plugin-hello-world'
import type { UserConfig } from 'vite'
// import { alias } from '../../alias'

// https://vitejs.dev/config/
const config: UserConfig = {
  plugins: [
    Stacks(),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
