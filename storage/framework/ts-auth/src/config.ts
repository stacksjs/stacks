import type { AuthConfig } from './types'
import { loadConfig } from 'bunfig'

export const defaultConfig: AuthConfig = {
  verbose: true,
}

// eslint-disable-next-line antfu/no-top-level-await
export const config: AuthConfig = await loadConfig({
  name: 'auth',
  defaultConfig,
})
