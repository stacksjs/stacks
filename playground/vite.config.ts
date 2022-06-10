import { defineConfig } from 'vite'
import { Stacks, resolve, buildVueComponents, buildWebComponents } from '../packages/vite/src'

// eslint-disable-next-line no-console
console.log('test');

/** @type {import('vite').UserConfig} */
const config = {
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
