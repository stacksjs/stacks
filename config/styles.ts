/**
 * This configuration is used to define your project-specific style guide.
 */

import type { Shortcuts } from '@ow3/stacks'

/**
 * Shortcuts provide you with the ability to combine utility names for reusability purposes.
 */
const shortcuts: Shortcuts = [
  // ['btn', 'px-4 py-1 rounded inline-block bg-teal-600 text-white cursor-pointer hover:bg-teal-700 disabled:cursor-default disabled:bg-gray-600 disabled:opacity-50'],
  // ['icon-btn', 'inline-block cursor-pointer select-none opacity-75 transition duration-200 ease-in-out hover:opacity-100 hover:text-teal-600'],
]

/**
 * Use the `safelist` option to ensure the generation of those utility classes.
 * This is useful when certain class names don’t exist in your content files.
 */
const safelist = 'prose prose-sm m-auto text-left'

/**
 * The trigger defines the class name markup you want to add into your components.
 */
const trigger = ':stacks:'

/**
 * When transforming all utility classes into a single class, this prefix will be added to the generated class.
 */
const classPrefix = 'stacks-'

export { trigger, classPrefix, shortcuts, safelist }
