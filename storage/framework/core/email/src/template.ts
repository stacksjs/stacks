import type { RenderOptions } from '@vue-email/compiler'
import process from 'node:process'
import { resourcesPath } from '@stacksjs/path'
import { config } from '@vue-email/compiler'

interface HtmlResult {
  html: string
  text: string
}

export async function template(path: string, options?: RenderOptions): Promise<HtmlResult> {
  const templatePath = path.endsWith('.vue') ? path : `${path}.vue`

  const email = config(resourcesPath('emails'), {
    verbose: !!process.env.DEBUG,
    // options: {
    //   baseUrl: 'https://APP_URL/',
    // },
  })

  return await email.render(templatePath, options)
}
