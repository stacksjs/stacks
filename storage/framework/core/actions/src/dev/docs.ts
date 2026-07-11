// Dev docs server — loads project BunPress config and mounts under /docs on APP_URL.
/* eslint-disable ts/no-top-level-await */
import { overridesReady, config as appConfig, docs } from '@stacksjs/config'
import { projectPath } from '@stacksjs/path'
import { startServer } from '@stacksjs/bunpress'
import type { BunPressConfig } from '@stacksjs/bunpress'

await overridesReady

const port = Number(process.env.PORT_DOCS) || appConfig.ports?.docs || 3006
const appUrl = String(process.env.APP_URL || appConfig.app?.url || '')
const domain = appUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
const pathMountedDocs = domain
  && domain !== 'localhost'
  && !domain.includes(':')

const devBaseUrl = pathMountedDocs ? `https://${domain}/docs` : undefined

const bunPressConfig: BunPressConfig = {
  verbose: false,
  docsDir: projectPath('docs'),
  outDir: projectPath('dist/docs'),
  ...docs,
  markdown: docs.markdown ?? {},
  ...(devBaseUrl && {
    sitemap: {
      ...docs.sitemap,
      baseUrl: devBaseUrl,
    },
  }),
}

await startServer({
  port,
  root: projectPath('docs'),
  watch: true,
  quiet: true,
  config: bunPressConfig,
})
