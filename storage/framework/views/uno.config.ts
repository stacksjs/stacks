// import { defineConfig, presetIcons, presetTypography, presetWebFonts, presetWind, transformerDirectives, transformerVariantGroup } from 'unocss'
// import { presetForms } from '@julr/unocss-preset-forms'
// import transformerCompileClass from '@unocss/transformer-compile-class'
// import { ui } from '@stacksjs/config'

// export default defineConfig({
//   shortcuts: ui.shortcuts,

//   presets: [
//     presetWind(), // allows for Tailwind utility classes
//     presetForms(), // allows for form Tailwind's form styling
//     presetTypography(),
//     presetIcons({
//       prefix: 'i-',
//       warn: true,
//       // collections: ui.icons,
//       extraProperties: {
//         'display': 'inline-block',
//         'vertical-align': 'middle',
//       },
//     }),

//     presetWebFonts({
//       provider: 'bunny', // privacy-friendly Google Web Fonts proxy
//       fonts: {
//         // these will extend the default theme
//         sans: 'Inter',
//         mono: 'Inter',
//       },
//     }),
//   ],

//   transformers: [
//     transformerCompileClass({
//       classPrefix: ui.classPrefix,
//       trigger: ui.trigger,
//     }),
//     transformerDirectives(),
//     transformerVariantGroup(),
//   ],

//   safelist: ui.safelist?.split(' ') || [],
// })

import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetTypography,
  presetUno,
  presetWebFonts,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'

export default defineConfig({
  shortcuts: [
    ['btn', 'px-4 py-1 rounded inline-block bg-teal-700 text-white cursor-pointer !outline-none hover:bg-teal-800 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
    ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600'],
  ],
  presets: [
    presetUno(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
    }),
    presetTypography(),
    presetWebFonts({
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'DM Mono',
      },
    }),
  ],
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
  safelist: 'prose m-auto text-left'.split(' '),
})
