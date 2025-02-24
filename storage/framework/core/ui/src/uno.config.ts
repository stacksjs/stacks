import type { UserConfig as UnoConfig } from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import { ui } from '@stacksjs/config'
import { path } from '@stacksjs/path'
import presetWebFonts from '@unocss/preset-web-fonts'
import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local'
import {
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  // presetWebFonts,
  transformerCompileClass,
  transformerDirectives,
  transformerVariantGroup,

} from 'unocss'
import { presetHeadlessUi } from 'unocss-preset-primitives'

const config: UnoConfig = {
  shortcuts: ui.shortcuts,

  content: {
    pipeline: {
      include: [/\.(stx|vue|[jt]sx|mdx?|elm|html)($|\?)/],
      // exclude files
      // exclude: []
    },
  },

  presets: [
    presetUno(), // allows for Tailwind utility classes
    presetAttributify(),
    presetHeadlessUi(),
    presetForms(), // allows for form Tailwind's form styling
    presetTypography(),
    presetIcons({
      prefix: 'i-',
      warn: true,
      collections: {
        hugeicons: () => import('@iconify-json/hugeicons/icons.json').then(i => i.default as any),
      },
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),

    presetWebFonts({
      provider: 'bunny', // privacy-friendly Google Web Fonts proxy
      fonts: {
        sans: 'Inter',
        serif: 'Inter',
        mono: 'Fira Code',
      },

      processors: createLocalFontProcessor({
        // Directory to cache the fonts
        cacheDir: path.projectPath('node_modules/.cache/unocss/fonts'),

        // Directory to save the fonts assets
        fontAssetsDir: path.resourcesPath('assets/fonts'),

        // Base URL to serve the fonts from the client
        fontServeBaseUrl: path.resourcesPath('assets/fonts'),
      }),
    }),
  ],

  transformers: [
    transformerCompileClass({
      classPrefix: ui.classPrefix,
      trigger: ui.trigger,
    }),
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  safelist: ui.safelist?.split(' ') || [],

  theme: {
    extend: {
      colors: {
        primary: '#1F1FE9',
        secondary: '#B80C09',
        success: '#CAFE48',
        dark: '#1A181B',
        light: '#F5F3F5',
      },
    },
  },
}

export default config
