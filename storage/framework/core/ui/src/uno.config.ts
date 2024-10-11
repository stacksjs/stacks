import { presetForms } from '@julr/unocss-preset-forms'
import { ui } from '@stacksjs/config'
import {
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerCompileClass,
  transformerDirectives,
  transformerVariantGroup,
  type UserConfig as UnoConfig,
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
        heroicons: () => import('@iconify-json/heroicons/icons.json').then(i => i.default as any),
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
        // mono: 'Inter',
      },
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
