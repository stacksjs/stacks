import type { UserConfig } from 'unocss'
import { defineConfig, presetIcons, presetTypography, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
import { presetForms } from '@julr/unocss-preset-forms'
import transformerCompileClass from '@unocss/transformer-compile-class'
// import { ui } from '../../../config'
import type { UiOptions as Options } from '@stacksjs/types'

const uis: Options = {
  shortcuts: [
    ['btn', 'inline-flex items-center px-4 py-2 ml-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer'],
  ],
  safelist: 'prose prose-sm m-auto text-left',
  trigger: ':stx:',
  classPrefix: 'stx-',
  reset: 'tailwind',
  icons: {
    'heroicon-outline': () => import('@iconify-json/heroicons-outline/icons.json').then(i => i.default as any),
    'heroicon-solid': () => import('@iconify-json/heroicons-solid/icons.json').then(i => i.default as any),
  },
}

const config: UserConfig = defineConfig({
  shortcuts: uis.shortcuts,

  presets: [
    presetWind(), // allows for Tailwind utility classes
    presetForms(), // allows for form Tailwind's form styling
    presetTypography(),
    presetIcons({
      prefix: 'i-',
      warn: true,
      collections: uis.icons,
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
      classPrefix: uis.classPrefix,
      trigger: uis.trigger,
    }),
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  safelist: uis.safelist.split(' '),
})

export default config
