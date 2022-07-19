/**
 * This is the place where you configure your functions.
 * For all available options, see the FunctionsConfig type definition.
 */

import type { Hosts } from 'stacks/types'
import { HOST, LIBRARY_NAME, ORGANIZATION_NAME, PACKAGE_MANAGER } from './library'

export const packageManager: String = PACKAGE_MANAGER
export const packageName: String = `${ORGANIZATION_NAME}/${LIBRARY_NAME}-fx`
export const host: Hosts = HOST
