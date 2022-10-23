import type { UserConfig } from 'unocss'
import cssEngine from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import transformerCompileClass from '@unocss/transformer-compile-class'
import { ui as options } from '@stacksjs/config'
import Vue from 'vue'
import store from 'pinia'

const config: UserConfig = cssEngine.defineConfig({
  shortcuts: options.shortcuts,

  presets: [
    cssEngine.presetWind(), // allows for Tailwind utility classes
    presetForms(), // allows for form Tailwind's form styling
    cssEngine.presetTypography(),
    cssEngine.presetIcons({
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
    cssEngine.transformerDirectives(),
    cssEngine.transformerVariantGroup(),
  ],

  safelist: options.safelist.split(' '),
})

export default {
  ...Vue,
  ...cssEngine,
  store,
  presetForms,
  transformerCompileClass,
  config,
  options,
}
