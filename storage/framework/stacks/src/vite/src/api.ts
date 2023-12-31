import type { ViteConfig } from 'src/types/src'

export const apiConfig: ViteConfig = {
  base: '/api/',
  server: {
    port: 3334,
    proxy: {
      '/': 'http://localhost:3999',
    },
  },
}

export default function (config: { command: string }): ViteConfig {
  if (config.command === 'serve')
    return apiConfig

  // command === 'build'
  return apiConfig
}
