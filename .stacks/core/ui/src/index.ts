import type { UserConfig } from 'unocss'
import { defineConfig, presetIcons, presetTypography, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import transformerCompileClass from '@unocss/transformer-compile-class'
import { ui } from 'config'

const config: UserConfig = defineConfig({
  shortcuts: ui.shortcuts,

  presets: [
    presetWind(), // allows for Tailwind utility classes
    presetForms(), // allows for form Tailwind's form styling
    presetTypography(),
    presetIcons({
      prefix: 'i-',
      warn: true,
      collections: ui.icons,
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
      classPrefix: ui.classPrefix,
      trigger: ui.trigger,
    }),
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  safelist: ui.safelist.split(' '),
})

export default config
