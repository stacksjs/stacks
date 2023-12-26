import Vue from '@vitejs/plugin-vue'
import type { Plugin } from 'vite'
import Markdown from 'unplugin-vue-markdown/vite'
import LinkAttributes from 'markdown-it-link-attributes'
import Shiki from 'markdown-it-shikiji'

export function uiEngine(isWebComponent = false): Plugin {
  const include = [/\.stx/, /\.vue$/, /\.md$/]

  if (isWebComponent) {
    return Vue({
      include,
      template: {
        compilerOptions: {
          isCustomElement: () => true,
        },
      },
    })
  }

  return Vue({
    include,
  })
}

export function markdown() {
  // https://github.com/unplugin/unplugin-vue-markdown
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

      md.use(await Shiki({
        defaultColor: false,
        themes: {
          light: 'vitesse-light',
          dark: 'vitesse-dark',
        },
      }))
    },
  })
}
