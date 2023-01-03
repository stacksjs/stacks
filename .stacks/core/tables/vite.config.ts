import { defineConfig } from 'vite'

export default defineConfig(({ command, mode, ssrBuild }) => {
  if (command === 'serve') {
    return {
      // dev specific config
    }
  }
  else {
    // command === 'build'
    return {
      // build specific config
    }
  }
})
