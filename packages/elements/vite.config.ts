import { defineConfig } from 'vite'
import { Stacks, resolveOptions as resolve} from '../vite/src'
import type { UserConfig } from 'vite'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve,

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
