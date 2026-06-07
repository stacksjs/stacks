import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ErrorPageConfig, QueryInfo, RequestContext, RoutingContext, UserContext } from './error-page'
import { buildErrorPageViewModel } from './error-page-view-model'

const VIEWS_DIR = join(dirname(fileURLToPath(import.meta.url)), 'views/errors')

let renderTemplateFn: typeof import('@stacksjs/stx').renderTemplate | null = null

async function getRenderTemplate() {
  if (!renderTemplateFn) {
    const mod = await import('@stacksjs/stx')
    renderTemplateFn = mod.renderTemplate
  }
  return renderTemplateFn
}

export async function renderDevErrorPage(opts: {
  error: Error
  status: number
  config: ErrorPageConfig
  framework?: { name: string, version?: string }
  request?: RequestContext
  routing?: RoutingContext
  user?: UserContext
  queries?: QueryInfo[]
}): Promise<string> {
  const viewModel = await buildErrorPageViewModel(opts)
  const renderTemplate = await getRenderTemplate()

  return renderTemplate(join(VIEWS_DIR, 'show.stx'), {
    context: viewModel,
    layout: join(VIEWS_DIR, 'layout.stx'),
    injectCSS: true,
    templateOnly: true,
    processClientScripts: false,
    title: viewModel.pageTitle,
  })
}
