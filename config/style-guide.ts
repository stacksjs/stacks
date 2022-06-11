import type { UserShortcuts } from 'unocss'

let shortcuts: UserShortcuts
const safelist = 'prose prose-sm m-auto text-left'
const iconCollections = {
  'heroicon-outline': () => import('@iconify-json/heroicons-outline/icons.json').then(i => i.default as any),
  'heroicon-solid': () => import('@iconify-json/heroicons-solid/icons.json').then(i => i.default as any),
}

// shortcuts = [
//   ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
//   ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600'],
// ]

export { shortcuts, safelist, iconCollections }
