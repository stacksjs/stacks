import type { I18n } from 'vue-email'
import process from 'node:process'
import { resourcesPath } from '@stacksjs/path'
import { config } from '@vue-email/compiler'

export interface RenderOptions {
  props?: Record<string, unknown>
  i18n?: I18n
}

interface HtmlResult {
  html: string
  text: string
}

export async function template(path: string, options?: RenderOptions): Promise<HtmlResult> {
  const email = config(resourcesPath('emails'), {
    verbose: !!process.env.DEBUG,
    // options: {
    //   baseUrl: 'https://APP_URL/',
    // },
  })

  return await email.render(path, options)
}
