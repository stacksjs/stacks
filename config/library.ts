/**
 * The environment variables.
 *
 * Please note: these values may be updated at any time, but if you update the "library name,"
 * you most likely will create a new npm package on future releases/updates.
 * We suggest these names not be updated unless you have a very strong, specific reason for it.
 * Naming conventions are complicated, yet important, to get right.
 *
 * That's why we recommend to only set the "organization name" & "library name."
 */

import type { Hosts } from 'stacks/types'

export const defaultLanguage = 'en'

export const organizationName = '@ow3'
export const libraryName = 'hello-world'
export const packageManager = 'npm'
export const host: Hosts = 'netlify'

export const packageName = `${organizationName}/${libraryName}-stack`
export const functionsLibraryName = `${organizationName}/${libraryName}-fx`
export const componentsLibraryName = `${organizationName}/${libraryName}-ui`
export const webComponentsLibraryName = `${organizationName}/${libraryName}-elements`
