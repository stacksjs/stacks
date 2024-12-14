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

  if (
    options.type
    && ['frontend', 'api', 'library', 'desktop', 'docs', 'example', 'dashboard', 'system-tray', 'database'].includes(
      options.type,
    )
  ) {
    return {
      host: serversMap[options.type].host,
      port: serversMap[options.type].port,
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
