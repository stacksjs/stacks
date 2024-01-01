import {
  defineConfig,
  // presetAttributify,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind,
  transformerCompileClass,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import { ui } from '@stacksjs/config'

export default defineConfig({
  shortcuts: ui.shortcuts,

  content: {
    pipeline: {
      include: [
        /\.(stx|vue|[jt]sx|mdx?|elm|html)($|\?)/,
      ],
      // exclude files
      // exclude: []
    },
  },

  presets: [
    presetWind(), // allows for Tailwind utility classes
    presetForms(), // allows for form Tailwind's form styling
    presetTypography(),
    presetIcons({
      prefix: 'i-',
      warn: true,
      // collections: ui.icons,
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
        mono: 'Inter',
      },
    }),

    // presetAttributify(),
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
})
