import type { UserConfig } from 'unocss'
import { defineConfig, presetIcons, presetTypography, presetWebFonts, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
import transformerCompileClass from '@unocss/transformer-compile-class'
import { classPrefix, icons as collections, safelist, shortcuts, trigger } from '../../config/styles'

const config: UserConfig = defineConfig({
  shortcuts,

  presets: [
    presetWind(), // allows for Tailwind utility classes
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
    presetWebFonts({
      provider: 'bunny',
      fonts: {
        // these will extend the default theme
        sans: 'Inter',
        mono: 'Inter',
      },
    }),
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
