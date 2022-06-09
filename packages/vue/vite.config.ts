import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import Stacks from '../vite/src'
import Inspect from 'vite-plugin-inspect'

// https://vitejs.dev/config/
const config: UserConfig = {
  plugins: [
    Inspect(), // only applies in dev mode & visit localhost:3000/__inspect/ to inspect the modules

    Stacks({
      root: './src',
    }),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  // eslint-disable-next-line no-console
  console.log('config is', config);

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
