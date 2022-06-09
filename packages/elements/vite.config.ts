import { defineConfig } from 'vite'
import Stacks from '../vite/src'
import type { UserConfig } from 'vite'

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
