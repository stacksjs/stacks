interface ServerOptions {
  type?: 'docs' | 'api' | 'library' | 'app' | 'desktop' | 'example' | 'views'
  host?: string
  port?: number
  open?: boolean
}

export function config(options: ServerOptions) {
  const typeToHostMap = {
    api: 'api.stacks.test',
    app: 'app.stacks.test',
    desktop: 'desktop.stacks.test',
    docs: 'localhost',
    library: 'localhost',
    views: 'localhost',
    example: 'example.stacks.test',
  }

  if (options.type && ['docs', 'api', 'library', 'app', 'desktop', 'example', 'views'].includes(options.type)) {
    return {
      host: typeToHostMap[options.type],
      port: 3333,
      open: true,
    }
  }

  return {
    host: options.host || 'stacks.test',
    port: options.port || 3333,
    open: options.open || false,
  }
}
