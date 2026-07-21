import type { StackExtensionRegistry } from '@stacksjs/types'
import { stackExtensionRegistry } from '@stacksjs/types'

export type Registry = StackExtensionRegistry

export const registry: Registry = Object.entries(stackExtensionRegistry).map(([name, entry]) => ({
  name,
  github: entry.github,
  package: entry.package,
  description: entry.description,
}))

export default registry
