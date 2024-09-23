import LinkAttributes from 'markdown-it-link-attributes'
import Shiki from 'markdown-it-shikiji'
import Markdown from 'unplugin-vue-markdown/vite'
import type { Plugin } from 'vite'

export function markdown(): Plugin {
  return {
    name: 'markdown-plugin',

    ...Markdown({
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
    }),
  }
}
