import { defineConfig } from 'vite'
import { Stacks, resolveOptions as resolve } from '../packages/vite/src'

// eslint-disable-next-line no-console
console.log('test');

/** @type {import('vite').UserConfig} */
const config = {
  resolve,

  plugins: [
    // the issue is that the paths are not properly resolved when using Stacks()
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
