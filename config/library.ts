/**
 * Your component & function library variables.
 *
 * These values may be updated at any time, but if you update
 * the "library name," it will create a new npm package for
 * future releases. Read more in its documentation:
 */

import type { Author, Contributors, Hosts, LanguageCode, LibraryName, LibraryOptions, LicenseType, OrganizationName, Repository, StackName } from 'stacks'

export const libraryName: LibraryName = 'hello-world'
export const organizationName: OrganizationName = '@ow3'
export const stackName: StackName = organizationName ? `${organizationName}/${libraryName}` : libraryName
export const repository: Repository = 'ow3org/stacks'
export const host: Hosts = 'netlify'

export const license: LicenseType = 'MIT'
export const author: Author = 'Chris Breuer'
export const contributors: Contributors = ['Chris Breuer <chris@ow3.org>']
export const defaultLanguage: LanguageCode = 'en'

export const componentsLibrary: LibraryOptions = {
  name: `${stackName}-vue`,
  description: 'Your Vue component library description',
  keywords: ['component', 'library', 'vue', 'vite', 'typescript', 'javascript'],
}

export const webComponentsLibrary: LibraryOptions = {
  name: `${stackName}-elements`,
  description: 'Your framework agnostic web component library description.',
  keywords: ['custom-elements', 'web-components', 'library', 'framework-agnostic', 'typescript', 'javascript'],
}

export const functionsLibrary: LibraryOptions = {
  name: `${stackName}-fx`,
  description: 'Your function library description.',
  keywords: ['functions', 'composables', 'library', 'typescript', 'javascript'],
  shouldBuildIife: false,
  shouldGenerateSourcemap: false,
}

export default { defaultLanguage, license, author, contributors, organizationName, libraryName, host, stackName, repository, componentsLibrary, functionsLibrary, webComponentsLibrary }
