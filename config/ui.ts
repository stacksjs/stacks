import type { UiOptions } from 'stacks'

/**
 * ### UI Engine Options
 *
 * This configuration defines all of your UI Engine options. Because Stacks is full-typed, you
 * may hover any of the options below and the definitions will be provided. In case you
 * have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export const ui: UiOptions = {
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
