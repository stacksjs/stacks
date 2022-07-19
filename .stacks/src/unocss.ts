import type { UserConfig } from 'unocss'
import { defineConfig, presetIcons, presetTypography, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
// presetWebFonts,
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
    // presetWebFonts({
    //   fonts: {
    //     sans: 'DM Sans',
    //     serif: 'DM Serif Display',
    //     mono: 'DM Mono',
    //   },
    // }),
  ],

  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
    transformerCompileClass({
      classPrefix,
      trigger,
    }),
  ],

  safelist: safelist.split(' '),
})

export default config
