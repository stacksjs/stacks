import type { ViteConfig } from '@stacksjs/types'

export const apiConfig: ViteConfig = {
  base: '/api/',
  server: {
    port: 3334,
    proxy: {
      '/': 'http://127.0.0.1:3999',
    },
  },
}

export default function (config: { command: string }): ViteConfig {
  if (config.command === 'serve')
    return apiConfig

  // command === 'build'
  return apiConfig
}
