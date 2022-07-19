/**
 * This is the place where you configure your functions.
 * For all available options, see the FunctionsConfig type definition.
 */

import type { Hosts } from 'stacks/types'
import { HOST, LIBRARY_NAME, ORGANIZATION_NAME, PACKAGE_MANAGER } from './library'

export const packageManager = PACKAGE_MANAGER
export const packageName = `${ORGANIZATION_NAME}/${LIBRARY_NAME}-fx`
export const host: Hosts = HOST
