/**
 * Define any of the icon collections you like to use via "icons in pure css."
 * See https://stacks.ow3.org/config/icons for a list of available icon sets.
 */
export const icons = {
  'heroicon-outline': () => import('@iconify-json/heroicons-outline/icons.json').then(i => i.default as any),
  'heroicon-solid': () => import('@iconify-json/heroicons-solid/icons.json').then(i => i.default as any),
}
