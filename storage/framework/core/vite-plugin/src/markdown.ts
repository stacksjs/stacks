import LinkAttributes from 'markdown-it-link-attributes'
import Shiki from 'markdown-it-shikiji'
import Markdown from 'unplugin-vue-markdown/vite'
import type { Plugin } from 'vite'

export function markdown(): Plugin {
  // @ts-expect-error - somehow a pwa error happens when we type `name` in antfus plugins so we are ignoring it everywhere in his plugins
  return Markdown({
    wrapperClasses: 'prose prose-sm m-auto text-left',
    headEnabled: true,
    async markdownItSetup(md) {
      md.use(LinkAttributes, {
        matcher: (link: string) => /^https?:\/\//.test(link),
        attrs: {
          target: '_blank',
          rel: 'noopener',
        },
      })
      md.use(
        await Shiki({
          defaultColor: false,
          themes: {
            light: 'vitesse-light',
            dark: 'vitesse-dark',
          },
        }),
      )
    },
  })
}
