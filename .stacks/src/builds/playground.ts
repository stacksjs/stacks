import type { ViteConfig } from '../core'
import { defineConfig, Stacks } from '../core'
import alias from '../../../config/alias'
import { resolve } from 'path'

const dirPath = resolve(__dirname, '../../../components/src')
const dtsPath = resolve(__dirname, '../../types/components.d.ts')

// https://vitejs.dev/config/
const config: ViteConfig = {
  root: resolve(__dirname, '../../../playground'),

  optimizeDeps: {
    include: ['stacks'],
  },  

  resolve: {
    alias,
  },

  plugins: [
    Stacks(dirPath, dtsPath),
  ],

  build: {
    rollupOptions: {
      // include: ['stacks'],
      output: {
        // exports: 'named',
        globals: {
          vue: 'Vue',
        },
      },
    },
  }
}

export default defineConfig(({ command }) => {
  if (command === 'serve')
    return config

  // command === 'build'
  return config
})
