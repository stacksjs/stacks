import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { pwaDocs as pwa } from '@stacksjs/docs'
import { path as p } from '@stacksjs/path'
import { withPwa } from '@vite-pwa/vitepress'
import { defineConfig } from 'vitepress'
import userConfig from '../../../../docs/config'
import viteConfig from './vite.config'

// https://vitepress.dev/reference/site-config
export default withPwa(
  defineConfig({
    srcDir: p.projectPath('docs'),
    outDir: p.frameworkPath('docs/dist'),
    cacheDir: p.frameworkPath('cache/docs'),
    assetsDir: '/assets',
    emptyOutDir: true,
    ignoreDeadLinks: true,

    // sitemap: {
    //   hostname: 'stacks.localhost',
    // },

    pwa,

    markdown: {
      theme: {
        light: 'github-light',
        dark: 'github-dark',
      },

      codeTransformers: [
        transformerTwoslash(),
      ],
    },

    vite: viteConfig,

    ...userConfig,
  }),
)
