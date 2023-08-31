interface ServerOptions {
  type?: 'docs' | 'api' | 'library' | 'app' | 'desktop' | 'example'
  host?: string
  port?: number
  open?: boolean
}

export function config(options: ServerOptions) {
  const typeToHostMap = {
    api: 'api.stacks.test',
    app: 'app.stacks.test',
    desktop: 'desktop.stacks.test',
    docs: 'docs.stacks.test',
    library: 'library.stacks.test',
    example: 'example.stacks.test',
  }

  if (options.type && ['docs', 'api', 'library', 'app', 'desktop', 'example'].includes(options.type)) {
    const host = typeToHostMap[options.type]

    return {
      host,
      port: 3333,
      open: false,
    }
  }

  return {
    host: options.host || 'stacks.localhost',
    port: options.port || 3333,
    open: options.open || false,
  }
}
