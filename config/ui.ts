import type { UiConfig } from '@stacksjs/types'

/**
 * **UI Engine Options**
 *
 * This configuration defines all of your UI Engine options. Because Stacks is fully-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  shortcuts: [
    [
      'btn',
      'inline-flex items-center px-4 py-2 ml-2 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 cursor-pointer',
    ],
  ],

  safelist: 'prose prose-sm m-auto text-left',
  trigger: ':stx:',
  classPrefix: 'stx-',
  reset: 'tailwind',

  icons: ['heroicons'],

  fonts: {
    email: {
      title: 'Mona',
      text: 'Hubot',
    },

    desktop: {
      title: 'Mona',
      text: 'Hubot',
    },

    mobile: {
      title: 'Mona',
      text: 'Hubot',
    },

    web: {
      title: 'Mona',
      text: 'Hubot',
    },
  },

  theme: {
    // ...
    colors: {
      veryCool: '#0000ff', // class="text-very-cool"
      brand: {
        primary: 'hsl(var(--hue, 217) 78% 51%)', // class="bg-brand-primary"
      },
    },
  },
} satisfies UiConfig
