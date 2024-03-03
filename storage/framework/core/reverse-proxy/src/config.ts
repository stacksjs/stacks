import { loadConfig } from 'c12'

// Get loaded config
const { config } = await loadConfig({
  name: 'reverse-proxy',
  defaults: {
    'localhost:3000': 'stacks.localhost',
  },
})

export { config }
