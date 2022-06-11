import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'
import { Stacks, resolveOptions as resolve } from '../vite/src'
// import { alias } from '../../alias'

// https://vitejs.dev/config/
const config: UserConfig = {
  resolve,

  plugins: [
    Stacks(),
  ],
}

// https://vitejs.dev/config
export default defineConfig(({ command }) => {
  // eslint-disable-next-line no-console
  console.log('config is', config)

  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
