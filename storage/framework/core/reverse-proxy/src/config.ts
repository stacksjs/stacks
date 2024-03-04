import { loadConfig } from 'c12'

// Get loaded config
const { config } = await loadConfig({
  name: 'reverse-proxy',
})

export { config }
