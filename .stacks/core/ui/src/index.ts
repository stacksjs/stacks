import type { UserConfig } from 'unocss'
import * as CssEngine from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import transformerCompileClass from '@unocss/transformer-compile-class'
import { ui as options } from '@stacksjs/config'
import * as UiEngine from 'vue'
import * as Store from 'pinia'

const config: UserConfig = CssEngine.defineConfig({
  shortcuts: options.shortcuts,

  presets: [
    CssEngine.presetWind(), // allows for Tailwind utility classes
    presetForms(), // allows for form Tailwind's form styling
    CssEngine.presetTypography(),
    CssEngine.presetIcons({
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
    CssEngine.transformerDirectives(),
    CssEngine.transformerVariantGroup(),
  ],

  safelist: options.safelist.split(' '),
})

export default {
  UiEngine,
  CssEngine,
  Store,
  presetForms,
  transformerCompileClass,
  config,
  options,
}
