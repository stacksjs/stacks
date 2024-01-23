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
      port: 3333,
    },

    'api': {
      host: 'localhost',
      port: 3334,
    },

    'dashboard': {
      host: 'localhost',
      port: 3335,
    },

    'library': { // component library
      host: 'localhost',
      port: 3336,
    },

    'desktop': {
      host: 'localhost',
      port: 3337,
    },

    'docs': {
      host: 'localhost',
      port: 3338,
    },

    'example': {
      host: 'localhost',
      port: 3339,
    },

    'system-tray': {
      host: 'localhost',
      port: 3340,
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
    port: options.port || 3333,
    open: options.open || false,
  }
}
