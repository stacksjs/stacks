import { projectPath } from '@stacksjs/path'
import { startServer } from '@stacksjs/bunpress'

const port = Number(process.env.PORT_DOCS) || 3006

await startServer({
  port,
  root: projectPath('docs'),
  watch: true,
  quiet: true,
} as any)
