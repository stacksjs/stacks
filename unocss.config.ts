import {
  defineConfig,
  presetIcons,
  // presetTypography,
  // presetWebFonts,
  presetWind,
  transformerDirectives,
  transformerVariantGroup,
  transformerCompileClass,
} from 'unocss'
// import { CLASS_PREFIX, CLASS_TRIGGER } from '#config/constants'
// import { icons as collections, safelist, shortcuts } from '#config/style'
import { CLASS_PREFIX, CLASS_TRIGGER } from './config/constants'
import { icons as collections, safelist, shortcuts } from './config/style'

export default defineConfig({
  shortcuts,

  presets: [
    presetWind(),
    presetIcons({
      prefix: 'i-',
      scale: 1.2,
      warn: true,
      collections,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    // presetTypography(),
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
      trigger: CLASS_TRIGGER,
      classPrefix: CLASS_PREFIX,
    }),
  ],

  safelist: safelist.split(' '),
})
