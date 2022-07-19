/**
 * This is the place where you configure your functions.
 * For all available options, see the FunctionsConfig type definition.
 */

import type { Hosts } from 'stacks/types'
import { LIBRARY_NAME, ORGANIZATION_NAME } from './library'

export const packageManager: String = 'npm'
export const packageName: String = `${ORGANIZATION_NAME}/${LIBRARY_NAME}-ui`
export const host: Hosts = 'netlify'
