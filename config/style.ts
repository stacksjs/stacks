import type { UserShortcuts } from 'unocss'

/**
 * Shortcuts provide you with the ability to combine utility names for reusability purposes.
 */
const shortcuts: UserShortcuts = [
  // ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
  // ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600'],
]

/**
 * Use the `safelist` option to ensure the generation of those utility classes.
 * This is useful when certain class names don’t exist in your content files.
 */
const safelist = 'prose prose-sm m-auto text-left'

/**
 * Define any of the icon collections you like to use via "icons in pure css."
 * See https://icon-sets.iconify.design/ for a list of available icon sets.
 */
const icons = {
  'heroicon-outline': () => import('@iconify-json/heroicons-outline/icons.json').then(i => i.default as any),
  'heroicon-solid': () => import('@iconify-json/heroicons-solid/icons.json').then(i => i.default as any),
}

export { shortcuts, safelist, icons }
