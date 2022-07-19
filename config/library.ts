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

export const ORGANIZATION_NAME = '@ow3'
export const LIBRARY_NAME = 'hello-world'
export const PACKAGE_MANAGER: String = 'npm'
export const HOST: Hosts = 'netlify'

export const packageName: String = `${ORGANIZATION_NAME}/${LIBRARY_NAME}-stack`
