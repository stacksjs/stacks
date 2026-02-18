import { projectPath } from '@stacksjs/path'

const port = Number(process.env.PORT_DOCS) || 3006

const { startServer } = await import('@stacksjs/bunpress')

await startServer({
  port,
  root: projectPath('docs'),
  watch: true,
  quiet: true,
} as any)
