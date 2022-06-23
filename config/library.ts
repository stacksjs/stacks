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

const ORGANIZATION_NAME = '@ow3'
const LIBRARY_NAME = 'hello-world'

const VUE_PACKAGE_NAME = `${LIBRARY_NAME}-vue`
const VUE_NPM_PACKAGE_NAME = `${ORGANIZATION_NAME}/${VUE_PACKAGE_NAME}`
const WEB_COMPONENTS_PACKAGE_NAME = `${LIBRARY_NAME}-elements`
const WEB_COMPONENTS_NPM_PACKAGE_NAME = `${ORGANIZATION_NAME}/${WEB_COMPONENTS_PACKAGE_NAME}`
const COMPOSABLE_PACKAGE_NAME = `${LIBRARY_NAME}-composable`
const COMPOSABLE_NPM_PACKAGE_NAME = `${ORGANIZATION_NAME}/${COMPOSABLE_PACKAGE_NAME}`

export { ORGANIZATION_NAME, LIBRARY_NAME, VUE_PACKAGE_NAME, VUE_NPM_PACKAGE_NAME, WEB_COMPONENTS_PACKAGE_NAME, WEB_COMPONENTS_NPM_PACKAGE_NAME, COMPOSABLE_PACKAGE_NAME, COMPOSABLE_NPM_PACKAGE_NAME }
