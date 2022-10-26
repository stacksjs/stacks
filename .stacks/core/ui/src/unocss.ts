import type { UserConfig } from 'unocss'
import { defineConfig, presetIcons, presetTypography, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import transformerCompileClass from '@unocss/transformer-compile-class'
import { ui as options } from '@stacksjs/config'

const config: UserConfig = defineConfig({
  shortcuts: options.shortcuts,

  presets: [
    presetWind(), // allows for Tailwind utility classes
    presetForms(), // allows for form Tailwind's form styling
    presetTypography(),
    presetIcons({
      prefix: 'i-',
      warn: true,
      collections: options.icons,
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
      classPrefix: options.classPrefix,
      trigger: options.trigger,
    }),
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  safelist: options.safelist.split(' '),
})

export default config
