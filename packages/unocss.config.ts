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

const config: UserConfig = {
  // shortcuts: [
  //   ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
  //   ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600'],
  // ],

  presets: [
    presetWind(),
    presetIcons({
      prefix: 'i-',
      scale: 1.2,
      warn: true,
      collections: {
        'heroicon-outline': () => import('@iconify-json/heroicons-outline/icons.json').then(i => i.default as any),
        'heroicon-solid': () => import('@iconify-json/heroicons-solid/icons.json').then(i => i.default as any),
      },
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
      trigger: ':stacks:',
      classPrefix: 'stacks-',
    }),
  ],

  safelist: 'prose prose-sm m-auto text-left'.split(' '),
}

export default defineConfig(config)
