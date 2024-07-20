import process from 'node:process'
import { resourcesPath } from '@stacksjs/path'
import { config } from '@vue-email/compiler'
import type { I18n } from 'vue-email'

export interface RenderOptions {
  props?: Record<string, unknown>
  i18n?: I18n
}

export const template = async (path: string, options?: RenderOptions) => {
  const email = config(resourcesPath('emails'), {
    verbose: !!process.env.DEBUG,
    // options: {
    //   baseUrl: 'https://APP_URL/',
    // },
  })

  return await email.render(path, options)
}
