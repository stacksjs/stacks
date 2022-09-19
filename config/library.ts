/**
 * Your component & function library variables.
 *
 * These values may be updated at any time, but if you update the "library name,"
 * it will create a new npm package with future releases. Be careful when
 * updating these settings. Read more in its documentation:
 */

import type { Hosts } from 'stacks'

export const libraryName = 'hello-world'
export const organizationName = '@ow3'
export const stackName = organizationName ? `${organizationName}/${libraryName}` : libraryName
export const repository = 'ow3org/stacks'
export const host: Hosts = 'netlify'

export const license = 'MIT'
export const author = 'Chris Breuer'
export const contributors = ['Chris Breuer <chris@ow3.org>']
export const defaultLanguage = 'en'

export const componentsLibrary = {
  name: `${stackName}-elements`,
  description: 'Your framework agnostic web component library description.',
  keywords: ['component', 'library', 'vue', 'vite', 'typescript', 'javascript'],
}

export const webComponentsLibrary = {
  name: `${stackName}-vue`,
  description: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
  keywords: ['component', 'library', 'vue', 'vite', 'typescript', 'javascript'],
}

export const functionsLibrary = {
  name: `${stackName}-fx`,
  description: 'Your function library description.',
  keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
  shouldBuildIife: false,
}

export default { defaultLanguage, license, author, contributors, organizationName, libraryName, host, stackName, repository, componentsLibrary, functionsLibrary, webComponentsLibrary }
