/**
 * Your component & function library variables.
 *
 * These values may be updated at any time, but if you update the "library name,"
 * it will create a new npm package with future releases. Be careful when
 * updating these settings. Read more in its documentation:
 */

import type { Hosts } from 'stacks/types'

export const license = 'MIT'
export const author = 'Chris Breuer'
export const contributors = ['Chris Breuer <chris@ow3.org>']
export const defaultLanguage = 'en'

export const libraryName = 'hello-world'
export const organizationName = '@ow3'
export const repository = 'ow3org/stacks'
export const host: Hosts = 'netlify'

export const stackName = `${organizationName}/${libraryName}`
export const functionLibraryName = `${organizationName}/${libraryName}-fx`
export const componentLibraryName = `${organizationName}/${libraryName}-vue`
export const webComponentLibraryName = `${organizationName}/${libraryName}-elements`

export const componentLibraryDescription = 'Your Vue component library description.'
export const webComponentLibraryDescription = 'Your framework agnostic web component library description.'
export const functionLibraryDescription = 'Your function library description.'

export const componentLibraryKeywords = ['component', 'library', 'vue', 'vite', 'typescript', 'javascript']
export const webComponentLibraryKeywords = ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript']
export const functionLibraryKeywords = ['functions', 'composables', 'library', 'typescript', 'javascript']

export default { defaultLanguage, license, author, contributors, organizationName, libraryName, host, stackName, componentLibraryName, webComponentLibraryName, componentLibraryDescription, webComponentLibraryDescription, functionLibraryDescription, componentLibraryKeywords, webComponentLibraryKeywords, functionLibraryKeywords, functionLibraryName, repository }
