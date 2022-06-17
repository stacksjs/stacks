import {
  defineConfig,
  presetIcons,
  presetTypography,
  // presetWebFonts,
  presetWind,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import transformerCompileClass from '@unocss/transformer-compile-class'
import { CLASS_PREFIX, CLASS_TRIGGER } from './config/constants'
import { icons as collections, safelist, shortcuts } from './config/style'

// eslint-disable-next-line no-console
console.log('building')

const config = defineConfig({
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
      classPrefix: CLASS_PREFIX,
      trigger: CLASS_TRIGGER,
    }),
  ],

  safelist: safelist.split(' '),
})

export default config
