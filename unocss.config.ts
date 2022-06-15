import {
  defineConfig,
  presetIcons,
  presetTypography,
  // presetWebFonts,
  presetWind,
  transformerDirectives,
  transformerVariantGroup,
  transformerCompileClass,
} from 'unocss'
import { CLASS_PREFIX, CLASS_TRIGGER } from './config/constants'
import { icons as collections, safelist, shortcuts } from './config/style'

// eslint-disable-next-line no-console
console.log('building');

export default defineConfig({
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
      trigger: CLASS_TRIGGER,
      classPrefix: CLASS_PREFIX,
    }),
  ],

  safelist: safelist.split(' '),
})
