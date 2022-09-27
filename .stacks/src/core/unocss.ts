import type { UserConfig } from 'unocss'
import { defineConfig, presetIcons, presetTypography, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
// import { defineConfig, presetIcons, presetTypography, presetWebFonts, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
import transformerCompileClass from '@unocss/transformer-compile-class'
import { classPrefix, icons as collections, safelist, shortcuts, trigger } from '../../../config/ui'

const config: UserConfig = defineConfig({
  shortcuts,

  presets: [
    presetWind(), // allows for Tailwind utility classes
    presetForms(), // allows for form Tailwind's form styling
    presetTypography(),
    presetIcons({
      prefix: 'i-',
      warn: true,
      collections,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    // presetWebFonts({
    //   provider: 'bunny', // privacy-friendly Google Web Fonts proxy
    //   fonts: {
    //     // these will extend the default theme
    //     sans: 'Inter',
    //     mono: 'Inter',
    //   },
    // }),
  ],

  transformers: [
    transformerCompileClass({
      classPrefix,
      trigger,
    }),
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  safelist: safelist.split(' '),
})

export default config
