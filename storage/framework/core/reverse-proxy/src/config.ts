import path from 'node:path'
import { loadConfig, watchConfig } from 'c12'

// Get loaded config
const { config } = await loadConfig({
  name: 'reverse-proxy',
  defaults: {
    from: 'localhost:3006', // 3000
    to: 'stacks.localhost',
  },
})

console.log('Loaded config:', config)
