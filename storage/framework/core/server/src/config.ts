interface ServerOptions {
  type?: 'frontend' | 'api' | 'library' | 'desktop' | 'docs' | 'example' | 'dashboard' | 'system-tray'
  host?: string
  port?: number
  open?: boolean
}

export function config(options: ServerOptions) {
  const serversMap = {
    'frontend': {
      host: 'localhost',
      port: 3000,
    },

    'api': {
      host: 'localhost',
      port: 3001,
    },

    'dashboard': {
      host: 'localhost',
      port: 3002,
    },

    'library': { // component library
      host: 'localhost',
      port: 3003,
    },

    'desktop': {
      host: 'localhost',
      port: 3004,
    },

    'docs': {
      host: 'localhost',
      port: 3005,
    },

    'example': {
      host: 'localhost',
      port: 3006,
    },

    'system-tray': {
      host: 'localhost',
      port: 3007,
    },
  }

  if (options.type && ['frontend', 'api', 'library', 'desktop', 'docs', 'example', 'dashboard', 'system-tray'].includes(options.type)) {
    return {
      host: serversMap[options.type].host,
      port: serversMap[options.type].port,
      open: true,
    }
  }

  return {
    host: options.host || 'stacks.localhost',
    port: options.port || 3000,
    open: options.open || false,
  }
}
