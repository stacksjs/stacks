import type { ServerOptions } from '@stacksjs/types'
import { ports } from '@stacksjs/config'

export function config(options: ServerOptions): {
  host: string
  port: number
  open: boolean
} {
  const serversMap = {
    'frontend': {
      host: 'localhost',
      port: ports.frontend,
    },

    'backend': {
      host: 'localhost',
      port: ports.backend,
    },

    'api': {
      host: 'localhost',
      port: ports.api,
    },

    'admin': {
      host: 'localhost',
      port: ports.admin,
    },

    'library': {
      // component library
      host: 'localhost',
      port: ports.library,
    },

    'desktop': {
      host: 'localhost',
      port: ports.desktop,
    },

    'docs': {
      host: 'localhost',
      port: ports.docs,
    },

    'email': {
      host: 'localhost',
      port: ports.email,
    },

    'inspect': {
      host: 'localhost',
      port: ports.inspect,
    },

    'system-tray': {
      host: 'localhost',
      port: ports.systemTray,
    },

    'database': {
      host: 'localhost',
      port: ports.database,
    },
  }

  if (options.type && options.type in serversMap) {
    return {
      host: serversMap[options.type as keyof typeof serversMap].host,
      port: serversMap[options.type as keyof typeof serversMap].port,
      open: false,
      // open: true,
    }
  }

  return {
    host: options.host || 'stacks.localhost',
    port: options.port || 3000,
    open: false,
    // open: options.open || false,
  }
}
