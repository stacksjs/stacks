import process from 'node:process'
import { path } from '@stacksjs/path'
import { config } from '@vue-email/compiler'
import type { I18n } from 'vue-email'

export interface RenderOptions {
  props?: Record<string, unknown>
  i18n?: I18n
}

const email = config(path.resourcesPath('emails'), {
  verbose: !!process.env.DEBUG,
  // options: {
  //   baseUrl: 'https://APP_URL/',
  // },
})

export const template = async (path: string, options?: RenderOptions) =>
  await email.render(path, options)
