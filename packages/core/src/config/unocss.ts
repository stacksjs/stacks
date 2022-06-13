import type { UserConfig } from 'unocss'
import {
  defineConfig,
  presetIcons,
  // presetTypography,
  // presetWebFonts,
  presetWind,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import transformerCompileClass from '@unocss/transformer-compile-class'
import { CLASS_PREFIX, CLASS_TRIGGER } from '../../../../config/constants'
import { icons as collections, safelist, shortcuts } from '../../../../config/style'

const config: UserConfig = {
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
}

export default defineConfig(config)
